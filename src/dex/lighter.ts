import { type InitOptions, type LighterClient, init } from '../common/config';
import { MARGIN_DIRECTION, MARGIN_MODE, ORDER_TYPE, TIF } from '../common/constants';
import type {
  Balance,
  Candle,
  FundingRate,
  MarketKind,
  Network,
  Order,
  OrderBook,
  Pair,
  Position,
  Price,
  Signer,
  SubAccount,
  Trade,
  UserTrade,
} from '../common/types';
import { scaleToInt } from '../common/utils';
import type { Unsubscribe } from '../common/ws';
import { updateAccountAssetConfig, updateAccountConfig } from '../rest/account-config';
import { getActiveOrders, getInactiveOrders } from '../rest/account-orders';
import { getAuthToken } from '../rest/auth';
import { cancelAllOrders, disarmCancelAll, scheduleCancelAll } from '../rest/cancel-all-orders';
import { cancelOrder } from '../rest/cancel-order';
import { createGroupedOrders } from '../rest/create-grouped-orders';
import { createSubAccount } from '../rest/create-sub-account';
import { modifyOrder } from '../rest/edit-order';
import { fetchAccount, getAccountInfo, getBalances, getPositions } from '../rest/get-account';
import { getCandles } from '../rest/get-candles';
import { getExchangeInfo } from '../rest/get-exchange-info';
import { getFundingHistory } from '../rest/get-funding-history';
import { getFundingRates } from '../rest/get-funding-rates';
import { getLiquidations } from '../rest/get-liquidations';
import { getNextNonce } from '../rest/get-next-nonce';
import { getOrderBook } from '../rest/get-order-book';
import { fetchMarketMetas, getPairs } from '../rest/get-pairs';
import { getPnl } from '../rest/get-pnl';
import { getPositionFunding } from '../rest/get-position-funding';
import { getPrices } from '../rest/get-prices';
import { getSubAccounts } from '../rest/get-sub-accounts';
import { getTrades } from '../rest/get-trades';
import { getUserTrades } from '../rest/get-user-trades';
import { placeOrder } from '../rest/place-order';
import { burnShares, createPublicPool, mintShares, updatePublicPool } from '../rest/pools';
import type { SendTxResult } from '../rest/send-tx';
import { stakeAssets, unstakeAssets } from '../rest/staking';
import { transfer } from '../rest/transfer';
import { updateLeverage } from '../rest/update-leverage';
import { updateMargin } from '../rest/update-margin';
import { getWasmInstance } from '../rest/wasm-signer';
import { withdraw } from '../rest/withdraw';
import { UnifiedWsClient } from '../ws/unified-client';
import type {
  CancelAllInput,
  CancelOrderInput,
  CandlesQuery,
  EditOrderInput,
  FundingQuery,
  IAccount,
  IDeadManSwitch,
  IIsolatedMargin,
  IMarginMode,
  IMarketData,
  IMarketMeta,
  IOrderHistory,
  IProductAccount,
  IPublicTrades,
  IRealtime,
  IRealtimePositions,
  IRemovableMargin,
  ISubAccounts,
  ITrading,
  IsolatedMarginInput,
  LeverageInput,
  MarginModeInput,
  OrderBookQuery,
  PlaceOrderInput,
  SymbolQuery,
  TradesQuery,
  WithdrawInput,
} from './contract';
import type {
  GroupedOrder,
  IAccountConfig,
  IAdvancedOrders,
  IApiKeys,
  INativeAccount,
  INativeMarket,
  IPools,
  IStaking,
  ISubAccountsAdmin,
  ITransfers,
  Transfer,
} from './native-contract';

/** Métadonnée de marché résolue (pour le mapping `name → market_id` + scaling décimal). */
interface MarketMeta {
  marketId: number;
  name: string;
  kind: MarketKind;
  priceDecimals: number;
  sizeDecimals: number;
  /** Fraction de marge initiale par défaut (bps ; sert de repli pour le levier). */
  defaultFraction: number;
}

/**
 * Cache des marchés par réseau : Lighter indexe ses endpoints par `market_id` (entier) et exige
 * des prix/quantités **entiers scalés** par les décimales du marché. La façade résout `name` →
 * `MarketMeta` une fois par réseau, puis convertit dans les deux sens.
 */
class MarketsResolver {
  private readonly cache = new Map<Network, Promise<MarketMeta[]>>();

  constructor(private readonly client: LighterClient) {}

  private networkOf(label?: string): Network {
    return label !== undefined ? (this.client.signers[label]?.network ?? 'mainnet') : 'mainnet';
  }

  all(label?: string): Promise<MarketMeta[]> {
    const network = this.networkOf(label);
    let promise = this.cache.get(network);
    if (promise === undefined) {
      promise = fetchMarketMetas(this.client, label).then((metas) =>
        metas.map((m) => ({
          marketId: m.market_id,
          name: m.symbol,
          kind: m.market_type === 'spot' ? ('spot' as const) : ('perp' as const),
          priceDecimals: m.supported_price_decimals ?? m.price_decimals ?? 0,
          sizeDecimals: m.supported_size_decimals ?? m.size_decimals ?? 0,
          defaultFraction:
            m.default_initial_margin_fraction ?? m.min_initial_margin_fraction ?? 10_000,
        })),
      );
      this.cache.set(network, promise);
    }
    return promise;
  }

  async meta(name: string, kind: MarketKind, label?: string): Promise<MarketMeta> {
    const all = await this.all(label);
    const meta = all.find((m) => m.name === name && m.kind === kind);
    if (meta === undefined) {
      throw new Error(`Marché ${kind} inconnu : "${name}"`);
    }
    return meta;
  }

  /** Tous les marchés d'un type donné. */
  async ofKind(kind: MarketKind, label?: string): Promise<MarketMeta[]> {
    return (await this.all(label)).filter((m) => m.kind === kind);
  }
}

/** Démarre un abonnement WS dont la cible dépend d'une résolution asynchrone (name → market_id). */
function deferredSubscribe(start: () => Promise<Unsubscribe>): Unsubscribe {
  let cancelled = false;
  let real: Unsubscribe | null = null;
  start()
    .then((unsub) => {
      if (cancelled) {
        unsub();
      } else {
        real = unsub;
      }
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    if (real !== null) {
      real();
    }
  };
}

/** Options de construction d'un {@link Lighter}. */
export interface LighterDexOptions extends Omit<InitOptions, 'signers'> {
  /** Label du signer par défaut (sinon le 1er du registre). */
  default?: string;
}

/**
 * Mapping des 6 types d'ordre du contrat commun vers les types natifs Lighter (tous supportés).
 * `market` ⇒ IOC + expiration nulle ; `trigger` ⇒ `triggerPrice` requis (stop / take-profit).
 */
const PLACE_ORDER_TYPE: Record<
  PlaceOrderInput['type'],
  { native: number; market: boolean; trigger: boolean }
> = {
  limit: { native: ORDER_TYPE.limit, market: false, trigger: false },
  market: { native: ORDER_TYPE.market, market: true, trigger: false },
  stop: { native: ORDER_TYPE.stopLossLimit, market: false, trigger: true },
  stopMarket: { native: ORDER_TYPE.stopLoss, market: true, trigger: true },
  takeProfit: { native: ORDER_TYPE.takeProfitLimit, market: false, trigger: true },
  takeProfitMarket: { native: ORDER_TYPE.takeProfit, market: true, trigger: true },
};

/**
 * Scope **marché** lié à un `label`, paramétré par `kind` (perp ou spot) — même classe pour
 * `perp()` et `spot()`, comme Aster. Expose le retrait de marge isolée → implémente
 * `IRemovableMargin`. Pas de scope `system()` (Lighter n'a pas d'endpoint ping/horloge dédié ;
 * les lectures de compte sont publiques par index).
 */
class LighterMarket
  implements
    IMarketData,
    IMarketMeta,
    IPublicTrades,
    IProductAccount,
    IOrderHistory,
    ITrading,
    IMarginMode,
    IIsolatedMargin,
    IRemovableMargin
{
  constructor(
    private readonly client: LighterClient,
    private readonly label: string | undefined,
    private readonly markets: MarketsResolver,
    private readonly kind: MarketKind,
  ) {}

  private signed(): string {
    if (this.label === undefined) {
      throw new Error('Action signée : aucun signer (ajoute des signers ou un défaut).');
    }
    return this.label;
  }

  private accountIndex(): number {
    const signer = this.client.signers[this.signed()];
    if (signer === undefined) {
      throw new Error(`Aucun signer enregistré sous "${this.label}".`);
    }
    return signer.accountIndex;
  }

  // ── IMarketData ──
  public getPairs(): Promise<Pair[]> {
    return getPairs(this.client, this.label, this.kind);
  }
  public async getCandles(query: CandlesQuery): Promise<Candle[]> {
    const meta = await this.markets.meta(query.name, this.kind, this.label);
    return getCandles(
      this.client,
      {
        marketId: meta.marketId,
        name: query.name,
        interval: query.interval,
        startTime: query.startTime,
        endTime: query.endTime,
        limit: query.limit,
        kind: this.kind,
      },
      this.label,
    );
  }
  public async getOrderBook(query: OrderBookQuery): Promise<OrderBook> {
    const meta = await this.markets.meta(query.name, this.kind, this.label);
    return getOrderBook(
      this.client,
      { marketId: meta.marketId, name: query.name, limit: query.limit, kind: this.kind },
      this.label,
    );
  }
  public getPrices(): Promise<Price[]> {
    return getPrices(this.client, this.label, this.kind);
  }
  public async getFundingHistory(query: FundingQuery): Promise<FundingRate[]> {
    const meta = await this.markets.meta(query.name, this.kind, this.label);
    return getFundingHistory(
      this.client,
      {
        marketId: meta.marketId,
        name: query.name,
        startTime: query.startTime,
        endTime: query.endTime,
        limit: query.limit,
      },
      this.label,
    );
  }

  // ── IMarketMeta ──
  public getExchangeInfo(): Promise<unknown> {
    return getExchangeInfo(this.client, this.label);
  }

  // ── IPublicTrades ──
  public async getTrades(query: TradesQuery): Promise<Trade[]> {
    const meta = await this.markets.meta(query.name, this.kind, this.label);
    return getTrades(this.client, { marketId: meta.marketId, limit: query.limit }, this.label);
  }

  // ── IProductAccount ──
  public async getPositions(query?: SymbolQuery): Promise<Position[]> {
    const positions = await getPositions(this.client, this.accountIndex(), this.label);
    return query?.name !== undefined ? positions.filter((p) => p.name === query.name) : positions;
  }
  public async getOpenOrders(query?: SymbolQuery): Promise<Order[]> {
    return this.fetchOrders(query, false);
  }
  public async getUserTrades(query?: SymbolQuery): Promise<UserTrade[]> {
    const accountIndex = this.accountIndex();
    const { auth } = await getAuthToken(this.client, this.label);
    const markets = await this.targetMarkets(query?.name);
    const lists = await Promise.all(
      markets.map((m) =>
        getUserTrades(
          this.client,
          { accountIndex, marketId: m.marketId, name: m.name, auth, kind: this.kind },
          this.label,
        ),
      ),
    );
    return lists.flat();
  }
  public getAccountInfo(): Promise<unknown> {
    return getAccountInfo(this.client, this.accountIndex(), this.label);
  }

  // ── IOrderHistory ──
  public async getOrderHistory(query?: SymbolQuery): Promise<Order[]> {
    return this.fetchOrders(query, true);
  }

  /** Ordres actifs/inactifs, pour un marché donné ou tous les marchés où le compte a une activité. */
  private async fetchOrders(query: SymbolQuery | undefined, inactive: boolean): Promise<Order[]> {
    const accountIndex = this.accountIndex();
    const { auth } = await getAuthToken(this.client, this.label);
    const markets = await this.targetMarkets(query?.name);
    const fetch = inactive ? getInactiveOrders : getActiveOrders;
    const lists = await Promise.all(
      markets.map((m) =>
        fetch(
          this.client,
          { accountIndex, marketId: m.marketId, name: m.name, auth, kind: this.kind },
          this.label,
        ),
      ),
    );
    return lists.flat();
  }

  /**
   * Marchés cibles d'une lecture : le marché nommé, sinon — en perp — ceux où le compte a une
   * position (borne efficace), et — en spot — tous les marchés spot (peu nombreux).
   */
  private async targetMarkets(name?: string): Promise<{ marketId: number; name: string }[]> {
    if (name !== undefined) {
      const meta = await this.markets.meta(name, this.kind, this.label);
      return [{ marketId: meta.marketId, name }];
    }
    if (this.kind === 'spot') {
      return (await this.markets.ofKind('spot', this.label)).map((m) => ({
        marketId: m.marketId,
        name: m.name,
      }));
    }
    const account = await fetchAccount(this.client, this.accountIndex(), this.label);
    return (account.positions ?? []).map((p) => ({ marketId: p.market_id, name: p.symbol }));
  }

  // ── ITrading ──
  public async placeOrder(input: PlaceOrderInput): Promise<Order> {
    // Lighter supporte les 6 types du contrat → mapping vers les types natifs (pas de « non
    // supporté »). Les throws ci-dessous sont de la **validation d'input** (champ requis absent).
    const spec = PLACE_ORDER_TYPE[input.type];
    if (input.price === undefined) {
      throw new Error(
        'placeOrder (Lighter) : `price` est requis (prix limite ou borne de protection en market).',
      );
    }
    if (spec.trigger && input.triggerPrice === undefined) {
      throw new Error(
        `placeOrder (Lighter) : \`triggerPrice\` est requis pour un ordre "${input.type}".`,
      );
    }
    const meta = await this.markets.meta(input.name, this.kind, this.label);
    const tif = spec.market
      ? TIF.ioc
      : input.tif === 'ioc'
        ? TIF.ioc
        : input.tif === 'alo'
          ? TIF.alo
          : TIF.gtt;
    const result = await placeOrder(this.client, this.signed(), {
      marketIndex: meta.marketId,
      clientOrderIndex: input.clientId !== undefined ? Number(input.clientId) : 0,
      baseAmount: scaleToInt(input.size, meta.sizeDecimals),
      price: scaleToInt(input.price, meta.priceDecimals),
      isAsk: input.side === 'sell' ? 1 : 0,
      orderType: spec.native,
      timeInForce: tif,
      reduceOnly: input.reduceOnly === true ? 1 : 0,
      triggerPrice:
        input.triggerPrice !== undefined ? scaleToInt(input.triggerPrice, meta.priceDecimals) : 0,
      orderExpiry: tif === TIF.ioc ? 0 : -1,
    });
    return {
      name: input.name,
      kind: this.kind,
      id: input.clientId ?? '',
      clientId: input.clientId ?? null,
      side: input.side,
      type: input.type,
      price: input.price,
      size: input.size,
      filled: '0',
      status: 'open',
      tif: input.tif ?? null,
      reduceOnly: input.reduceOnly ?? null,
      time: 0,
      xtras: { txHash: result.txHash },
    };
  }
  public async cancelOrder(input: CancelOrderInput): Promise<void> {
    const meta = await this.markets.meta(input.name, this.kind, this.label);
    const orderIndex = Number(input.id ?? input.clientId ?? 0);
    await cancelOrder(this.client, this.signed(), { marketIndex: meta.marketId, orderIndex });
  }
  public async cancelAllOrders(_input: CancelAllInput): Promise<{ cancelled: number | null }> {
    // Lighter annule au niveau **compte** (pas par marché) ; il ne renvoie pas de compteur.
    await cancelAllOrders(this.client, this.signed());
    return { cancelled: null };
  }
  public async editOrder(input: EditOrderInput): Promise<{ name: string; id: string }> {
    if (input.price === undefined) {
      throw new Error('editOrder (Lighter) : `price` est requis.');
    }
    const meta = await this.markets.meta(input.name, this.kind, this.label);
    const index = Number(input.id ?? input.clientId ?? 0);
    const result = await modifyOrder(this.client, this.signed(), {
      marketIndex: meta.marketId,
      index,
      baseAmount: scaleToInt(input.size, meta.sizeDecimals),
      price: scaleToInt(input.price, meta.priceDecimals),
      triggerPrice: 0,
    });
    return { name: input.name, id: result.txHash };
  }
  public async updateLeverage(input: LeverageInput): Promise<unknown> {
    const meta = await this.markets.meta(input.name, this.kind, this.label);
    const marginMode = await this.currentMarginMode(input.name);
    const fraction = Math.round(10_000 / Math.max(1, input.leverage));
    return updateLeverage(this.client, this.signed(), {
      marketIndex: meta.marketId,
      fraction,
      marginMode,
    });
  }

  // ── IMarginMode (mécanique cachée : Lighter passe par UpdateLeverage, comme HL) ──
  public async setMarginMode(input: MarginModeInput): Promise<void> {
    const meta = await this.markets.meta(input.name, this.kind, this.label);
    const positions = await getPositions(this.client, this.accountIndex(), this.label);
    const current = positions.find((p) => p.name === input.name);
    const fraction =
      current?.leverage != null && current.leverage > 0
        ? Math.round(10_000 / current.leverage)
        : meta.defaultFraction;
    await updateLeverage(this.client, this.signed(), {
      marketIndex: meta.marketId,
      fraction,
      marginMode: input.isolated ? MARGIN_MODE.isolated : MARGIN_MODE.cross,
    });
  }

  /** Mode de marge courant d'un marché (depuis la position), défaut cross. */
  private async currentMarginMode(name: string): Promise<number> {
    const positions = await getPositions(this.client, this.accountIndex(), this.label);
    const current = positions.find((p) => p.name === name);
    const mode = current?.xtras?.margin_mode;
    return typeof mode === 'number' ? mode : MARGIN_MODE.cross;
  }

  // ── IIsolatedMargin / IRemovableMargin ──
  public async addIsolatedMargin(input: IsolatedMarginInput): Promise<void> {
    const meta = await this.markets.meta(input.name, this.kind, this.label);
    await updateMargin(this.client, this.signed(), {
      marketIndex: meta.marketId,
      usdcAmount: scaleToInt(input.amount, 6),
      direction: MARGIN_DIRECTION.add,
    });
  }
  public async removeIsolatedMargin(input: IsolatedMarginInput): Promise<void> {
    const meta = await this.markets.meta(input.name, this.kind, this.label);
    await updateMargin(this.client, this.signed(), {
      marketIndex: meta.marketId,
      usdcAmount: scaleToInt(input.amount, 6),
      direction: MARGIN_DIRECTION.remove,
    });
  }
}

/** Scope **compte transverse** : soldes, sous-comptes, retrait, kill-switch. */
class LighterAccount implements IAccount, ISubAccounts, IDeadManSwitch {
  constructor(
    private readonly client: LighterClient,
    private readonly label: string | undefined,
  ) {}

  private signed(): string {
    if (this.label === undefined) {
      throw new Error('Action signée : aucun signer (ajoute des signers ou un défaut).');
    }
    return this.label;
  }

  private signer(): Signer {
    const signer = this.client.signers[this.signed()];
    if (signer === undefined) {
      throw new Error(`Aucun signer enregistré sous "${this.label}".`);
    }
    return signer;
  }

  public getBalances(): Promise<Balance[]> {
    return getBalances(this.client, this.signer().accountIndex, this.label);
  }
  public getSubAccounts(): Promise<SubAccount[]> {
    const signer = this.signer();
    if (signer.l1Address === undefined) {
      throw new Error('getSubAccounts (Lighter) : `l1Address` requis sur le signer.');
    }
    return getSubAccounts(this.client, signer.l1Address, this.label);
  }
  public withdraw(input: WithdrawInput): Promise<unknown> {
    return withdraw(this.client, this.signed(), { amount: scaleToInt(input.amount, 6) });
  }

  // ── IDeadManSwitch (Lighter : ScheduledCancelAll, échéance = timestamp absolu ms) ──
  public armCancelAll(afterMs: number): Promise<unknown> {
    return scheduleCancelAll(this.client, this.signed(), Date.now() + afterMs);
  }
  public disarm(): Promise<unknown> {
    return disarmCancelAll(this.client, this.signed());
  }
}

/**
 * Scope **temps réel** lié à un `label`. Lighter a un flux de positions (`account_all`) →
 * implémente `IRealtimePositions`. Les abonnements résolvent `name → market_id` en différé.
 */
class LighterRealtime implements IRealtime, IRealtimePositions {
  constructor(
    private readonly ws: UnifiedWsClient,
    private readonly client: LighterClient,
    private readonly label: string | undefined,
    private readonly markets: MarketsResolver,
    private readonly kind: MarketKind,
  ) {}

  public subscribeCandles(query: { name: string; interval: string }, cb: (c: Candle) => void) {
    return deferredSubscribe(async () => {
      const meta = await this.markets.meta(query.name, this.kind, this.label);
      return this.ws.subscribeCandles(meta.marketId, query.name, query.interval, this.kind, cb);
    });
  }
  public subscribeOrderBook(query: { name: string }, cb: (b: OrderBook) => void) {
    return deferredSubscribe(async () => {
      const meta = await this.markets.meta(query.name, this.kind, this.label);
      return this.ws.subscribeOrderBook(meta.marketId, query.name, this.kind, cb);
    });
  }
  public subscribeTrades(query: { name: string }, cb: (t: Trade) => void) {
    return deferredSubscribe(async () => {
      const meta = await this.markets.meta(query.name, this.kind, this.label);
      return this.ws.subscribeTrades(meta.marketId, cb);
    });
  }
  public subscribeBbo(query: { name: string }, cb: (b: OrderBook) => void) {
    return deferredSubscribe(async () => {
      const meta = await this.markets.meta(query.name, this.kind, this.label);
      return this.ws.subscribeBbo(meta.marketId, query.name, this.kind, cb);
    });
  }
  public subscribePrices(cb: (p: Price[]) => void) {
    // Lighter n'a pas de flux « tous les prix » : on s'abonne aux market_stats de chaque marché
    // du type courant et on émet le tableau complet à chaque mise à jour (fan-out).
    return deferredSubscribe(async () => {
      const markets = await this.markets.ofKind(this.kind, this.label);
      const byName = new Map<string, Price>();
      const unsubs = markets.map((m) =>
        this.ws.subscribeMarketStats(m.marketId, m.name, this.kind, (price) => {
          byName.set(m.name, price);
          cb([...byName.values()]);
        }),
      );
      return () => {
        for (const u of unsubs) {
          u();
        }
      };
    });
  }
  public subscribeOrders(cb: (o: Order) => void) {
    return this.subscribeAccount((msg) => {
      for (const raw of arrayField(msg, 'orders')) {
        const o = raw as Record<string, unknown>;
        cb({
          name: String(o.symbol ?? ''),
          kind: this.kind,
          id: String(o.order_id ?? o.order_index ?? ''),
          clientId: o.client_order_id != null ? String(o.client_order_id) : null,
          side: o.is_ask === true ? 'sell' : 'buy',
          type: 'other',
          price: o.price != null ? String(o.price) : null,
          size: String(o.initial_base_amount ?? '0'),
          filled: String(o.filled_base_amount ?? '0'),
          status: 'open',
          tif: null,
          reduceOnly: typeof o.reduce_only === 'boolean' ? o.reduce_only : null,
          time: Number(o.timestamp ?? 0),
          xtras: o,
        });
      }
    });
  }
  public subscribeUserTrades(cb: (t: UserTrade) => void) {
    return this.subscribeAccount((msg) => {
      for (const raw of arrayField(msg, 'trades')) {
        const t = raw as Record<string, unknown>;
        cb({
          name: String(t.symbol ?? ''),
          kind: this.kind,
          id: String(t.trade_id ?? ''),
          orderId: '',
          side: t.is_maker_ask === true ? 'buy' : 'sell',
          price: String(t.price ?? '0'),
          size: String(t.size ?? '0'),
          fee: '0',
          feeAsset: null,
          pnl: null,
          maker: null,
          time: Number(t.timestamp ?? 0),
          xtras: t,
        });
      }
    });
  }
  public subscribePositions(cb: (p: Position) => void) {
    return this.subscribeAccount((msg) => {
      for (const raw of arrayField(msg, 'positions')) {
        const p = raw as Record<string, unknown>;
        const size = String(p.size ?? p.position ?? '0');
        cb({
          name: String(p.symbol ?? ''),
          side:
            Number(size) === 0 ? null : p.side === 'short' || Number(p.sign) < 0 ? 'short' : 'long',
          size,
          entryPrice: p.entry_price != null ? String(p.entry_price) : null,
          markPrice: p.mark_price != null ? String(p.mark_price) : null,
          unrealizedPnl: p.unrealized_pnl != null ? String(p.unrealized_pnl) : null,
          leverage: null,
          liquidationPrice: null,
          margin: null,
          xtras: p,
        });
      }
    });
  }

  /** Abonnement `account_all` (auth résolu en différé) commun aux flux privés. */
  private subscribeAccount(handle: (msg: Record<string, unknown>) => void): Unsubscribe {
    return deferredSubscribe(async () => {
      const { auth, accountIndex } = await getAuthToken(this.client, this.label);
      return this.ws.subscribeAccountAll(accountIndex, auth, (msg) => {
        if (msg !== null && typeof msg === 'object' && !Array.isArray(msg)) {
          handle(msg as Record<string, unknown>);
        }
      });
    });
  }
}

/** Champ tableau d'un message brut (sécurisé). */
function arrayField(msg: Record<string, unknown>, key: string): unknown[] {
  const value = msg[key];
  return Array.isArray(value) ? value : [];
}

/** Base des scopes signés spécifiques Lighter. */
class LighterScope {
  constructor(
    protected readonly client: LighterClient,
    protected readonly label: string | undefined,
  ) {}

  protected signed(): string {
    if (this.label === undefined) {
      throw new Error('Action signée : aucun signer (ajoute des signers ou un défaut).');
    }
    return this.label;
  }

  /** Index de compte du signer (requis par les lectures authentifiées par index). */
  protected accountIndex(): number {
    const signer = this.client.signers[this.signed()];
    if (signer === undefined) {
      throw new Error(`Aucun signer enregistré sous "${this.label}".`);
    }
    return signer.accountIndex;
  }
}

/** Scope **apiKeys** : génération de clés, nonce, token d'auth — {@link ILighterApiKeys}. */
class LighterApiKeys extends LighterScope implements IApiKeys {
  private signer(): Signer {
    const signer = this.client.signers[this.signed()];
    if (signer === undefined) {
      throw new Error(`Aucun signer enregistré sous "${this.label}".`);
    }
    return signer;
  }
  public async generate(): Promise<{ privateKey: string; publicKey: string }> {
    const wasm = await getWasmInstance(this.client.restUrls[this.signer().network]);
    return wasm.generateApiKey();
  }
  public nextNonce(): Promise<number> {
    const signer = this.signer();
    return getNextNonce(this.client, signer.accountIndex, signer.apiKeyIndex, this.label);
  }
  public authToken(deadlineSeconds?: number): Promise<string> {
    return getAuthToken(this.client, this.signed(), deadlineSeconds).then((r) => r.auth);
  }
}

/** Scope **subAccounts** : création (la liste est dans `account()`) — {@link ISubAccountsAdmin}. */
class LighterSubAccounts extends LighterScope implements ISubAccountsAdmin {
  public create(): Promise<SendTxResult> {
    return createSubAccount(this.client, this.signed());
  }
}

/** Scope **transfers** : transfert de collatéral entre comptes — {@link ITransfers}. */
class LighterTransfers extends LighterScope implements ITransfers {
  public transfer(input: Transfer): Promise<SendTxResult> {
    return transfer(this.client, this.signed(), {
      toAccountIndex: input.toAccountIndex,
      amount: scaleToInt(input.amount, 6),
      memo: input.memo,
    });
  }
}

/** Scope **pools** : public pools (LP) — {@link IPools}. */
class LighterPools extends LighterScope implements IPools {
  public create(params: Parameters<typeof createPublicPool>[2]): Promise<SendTxResult> {
    return createPublicPool(this.client, this.signed(), params);
  }
  public update(params: Parameters<typeof updatePublicPool>[2]): Promise<SendTxResult> {
    return updatePublicPool(this.client, this.signed(), params);
  }
  public mint(params: Parameters<typeof mintShares>[2]): Promise<SendTxResult> {
    return mintShares(this.client, this.signed(), params);
  }
  public burn(params: Parameters<typeof burnShares>[2]): Promise<SendTxResult> {
    return burnShares(this.client, this.signed(), params);
  }
}

/** Scope **staking** — {@link IStaking}. */
class LighterStaking extends LighterScope implements IStaking {
  public stake(params: Parameters<typeof stakeAssets>[2]): Promise<SendTxResult> {
    return stakeAssets(this.client, this.signed(), params);
  }
  public unstake(params: Parameters<typeof unstakeAssets>[2]): Promise<SendTxResult> {
    return unstakeAssets(this.client, this.signed(), params);
  }
}

/** Scope **accountConfig** : mode de trading + activation d'un actif comme marge — {@link IAccountConfig}. */
class LighterAccountConfig extends LighterScope implements IAccountConfig {
  public update(params: Parameters<typeof updateAccountConfig>[2]): Promise<SendTxResult> {
    return updateAccountConfig(this.client, this.signed(), params);
  }
  public updateAsset(
    params: Parameters<typeof updateAccountAssetConfig>[2],
  ): Promise<SendTxResult> {
    return updateAccountAssetConfig(this.client, this.signed(), params);
  }
}

/** Scope **advancedOrders** : ordres groupés (TX 28) — {@link IAdvancedOrders}. */
class LighterAdvancedOrders extends LighterScope implements IAdvancedOrders {
  constructor(
    client: LighterClient,
    label: string | undefined,
    private readonly markets: MarketsResolver,
  ) {
    super(client, label);
  }

  public async placeBatch(orders: GroupedOrder[], groupingType = 0): Promise<SendTxResult> {
    const legs = await Promise.all(
      orders.map(async (o) => {
        const spec = PLACE_ORDER_TYPE[o.type];
        const meta = await this.markets.meta(o.name, 'perp', this.label);
        const tif = spec.market
          ? TIF.ioc
          : o.tif === 'ioc'
            ? TIF.ioc
            : o.tif === 'alo'
              ? TIF.alo
              : TIF.gtt;
        return {
          marketIndex: meta.marketId,
          clientOrderIndex: o.clientId !== undefined ? Number(o.clientId) : 0,
          baseAmount: scaleToInt(o.size, meta.sizeDecimals),
          price: scaleToInt(o.price, meta.priceDecimals),
          isAsk: o.side === 'sell' ? 1 : 0,
          orderType: spec.native,
          timeInForce: tif,
          reduceOnly: o.reduceOnly === true ? 1 : 0,
          triggerPrice:
            o.triggerPrice !== undefined ? scaleToInt(o.triggerPrice, meta.priceDecimals) : 0,
          orderExpiry: tif === TIF.ioc ? 0 : -1,
        };
      }),
    );
    return createGroupedOrders(this.client, this.signed(), { groupingType, orders: legs });
  }
}

/** Scope **marketData** : données de marché supplémentaires publiques — {@link INativeMarket}. */
class LighterMarketData extends LighterScope implements INativeMarket {
  public fundingRates() {
    return getFundingRates(this.client, this.label);
  }
}

/** Scope **account** : lectures de compte étendues authentifiées — {@link INativeAccount}. */
class LighterAccountExtra extends LighterScope implements INativeAccount {
  public async liquidations(query?: { limit?: number; marketId?: number }) {
    const { auth } = await getAuthToken(this.client, this.signed());
    return getLiquidations(
      this.client,
      { accountIndex: this.accountIndex(), auth, ...query },
      this.label,
    );
  }
  public async positionFunding(query?: { limit?: number; marketId?: number }) {
    const { auth } = await getAuthToken(this.client, this.signed());
    return getPositionFunding(
      this.client,
      { accountIndex: this.accountIndex(), auth, ...query },
      this.label,
    );
  }
  public async pnl(query: {
    resolution: string;
    startTime: number;
    endTime: number;
    countBack?: number;
    ignoreTransfers?: boolean;
  }) {
    const { auth } = await getAuthToken(this.client, this.signed());
    return getPnl(this.client, { accountIndex: this.accountIndex(), auth, ...query }, this.label);
  }
}

/**
 * Façade **Lighter** : `const dex = new Lighter({ deskA: signer }, { default: 'deskA' })`, puis
 * `dex.perp(label?)` / `dex.spot(label?)` (marché perp / spot), `dex.account(label?)` (compte),
 * `dex.ws(label?)` / `dex.wsSpot(label?)` (temps réel). Surplus spécifique via `dex.native.<cap>()` :
 * `apiKeys`, `subAccounts`, `transfers`, `pools`, `staking`, `accountConfig`, `advancedOrders`,
 * `marketData`, `account`.
 *
 * Chaque instance détient son propre {@link LighterClient} (config isolée). Le **signer WASM**
 * est instancié **une fois par réseau** (lazy au 1er appel signé), donc mainnet et testnet
 * coexistent réellement isolés (cf. `rest/wasm-signer`).
 */
export class Lighter {
  private readonly client: LighterClient;
  private readonly defaultLabel: string | undefined;
  private readonly markets: MarketsResolver;
  private readonly wsClients = new Map<string, UnifiedWsClient>();

  constructor(signers: Record<string, Signer> = {}, options: LighterDexOptions = {}) {
    const { default: defaultLabel, ...init0 } = options;
    this.client = init({ ...init0, signers });
    this.defaultLabel = defaultLabel ?? Object.keys(signers)[0];
    this.markets = new MarketsResolver(this.client);
  }

  private resolve(label?: string): string | undefined {
    return label ?? this.defaultLabel;
  }

  /** Scope marché **perp**. */
  public perp(label?: string): LighterMarket {
    return new LighterMarket(this.client, this.resolve(label), this.markets, 'perp');
  }

  /** Scope marché **spot** (Lighter expose aussi des marchés spot). */
  public spot(label?: string): LighterMarket {
    return new LighterMarket(this.client, this.resolve(label), this.markets, 'spot');
  }

  /** Scope **compte** transverse (soldes, sous-comptes, retrait). */
  public account(label?: string): LighterAccount {
    return new LighterAccount(this.client, this.resolve(label));
  }

  /** Scope **temps réel** perp. */
  public ws(label?: string): LighterRealtime {
    const resolved = this.resolve(label);
    return new LighterRealtime(
      this.unifiedWs(resolved),
      this.client,
      resolved,
      this.markets,
      'perp',
    );
  }

  /** Scope **temps réel** spot. */
  public wsSpot(label?: string): LighterRealtime {
    const resolved = this.resolve(label);
    return new LighterRealtime(
      this.unifiedWs(resolved),
      this.client,
      resolved,
      this.markets,
      'spot',
    );
  }

  // ── Surplus spécifique Lighter (namespace `native`, convention partagée par les 4 SDK) ──

  /**
   * Capacités **spécifiques à Lighter**, hors contrat unifié. Accès uniforme à tous les SDK :
   * `dex.native.<capacité>(label?)`. Noms d'interfaces (`IApiKeys`, `ITransfers`, `IPools`…) et
   * verbes **alignés** entre SDK quand le geste existe ailleurs ; seuls les types diffèrent.
   */
  public get native() {
    const c = this.client;
    const r = (label?: string) => this.resolve(label);
    return {
      /** Clés API + helpers de signature (génération, nonce, token d'auth) — `IApiKeys`. */
      apiKeys: (label?: string) => new LighterApiKeys(c, r(label)),
      /** Création de sous-comptes — `ISubAccountsAdmin`. */
      subAccounts: (label?: string) => new LighterSubAccounts(c, r(label)),
      /** Transfert de collatéral entre comptes — `ITransfers`. */
      transfers: (label?: string) => new LighterTransfers(c, r(label)),
      /** Public pools (LP) — `IPools`. */
      pools: (label?: string) => new LighterPools(c, r(label)),
      /** Stake / unstake d'actifs — `IStaking`. */
      staking: (label?: string) => new LighterStaking(c, r(label)),
      /** Mode de trading + activation d'un actif comme marge — `IAccountConfig`. */
      accountConfig: (label?: string) => new LighterAccountConfig(c, r(label)),
      /** Ordres groupés (TX 28, OCO/bracket) — `IAdvancedOrders`. */
      advancedOrders: (label?: string) => new LighterAdvancedOrders(c, r(label), this.markets),
      /** Données de marché supplémentaires (funding-rates courants) — `INativeMarket`. */
      marketData: (label?: string) => new LighterMarketData(c, r(label)),
      /** Lectures de compte étendues (liquidations, positionFunding, pnl) — `INativeAccount`. */
      account: (label?: string) => new LighterAccountExtra(c, r(label)),
    };
  }

  /** Un client WS unifié par label (réutilisé pour partager le ref-counting du socket). */
  private unifiedWs(label: string | undefined): UnifiedWsClient {
    const key = label ?? '';
    let ws = this.wsClients.get(key);
    if (ws === undefined) {
      ws = new UnifiedWsClient(this.client, { label });
      this.wsClients.set(key, ws);
    }
    return ws;
  }
}
