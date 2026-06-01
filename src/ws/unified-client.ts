import type { LighterClient } from '../common/config';
import type { NativeCandlestick, NativeTrade } from '../common/native';
import type {
  Candle,
  JsonValue,
  MarketKind,
  OrderBook,
  OrderBookLevel,
  Price,
  Trade,
} from '../common/types';
import type { Unsubscribe, WsClientOptions } from '../common/ws';
import { CandleConverter } from '../converters/candle';
import { TradeConverter } from '../converters/trade';
import { LighterWsClient } from './client';

type Obj = Record<string, JsonValue>;

const asObj = (v: JsonValue | undefined): Obj | undefined =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined;

const asArr = (v: JsonValue | undefined): JsonValue[] => (Array.isArray(v) ? v : []);

const num = (v: JsonValue | undefined): number => Number(v ?? 0);

/**
 * Parse un objet WS brut en {@link NativeCandlestick} (clés courtes `t,o,h,l,c,v,V`). Le wire WS a la
 * **même shape** que le REST `/candles` ; on type proprement au lieu d'un double cast `as unknown as`
 * (un changement de shape backend doit être attrapé ici, pas avalé silencieusement).
 */
const toNativeCandle = (o: Obj): NativeCandlestick => ({
  ...o,
  t: num(o.t),
  o: num(o.o),
  h: num(o.h),
  l: num(o.l),
  c: num(o.c),
  v: num(o.v),
  V: num(o.V),
  i: o.i !== undefined ? num(o.i) : undefined,
});

/** Parse un objet WS brut en {@link NativeTrade} (mêmes champs que le REST `/trades`). */
const toNativeTrade = (o: Obj): NativeTrade => ({
  ...o,
  market_id: num(o.market_id),
  size: String(o.size ?? ''),
  price: String(o.price ?? ''),
  is_maker_ask: typeof o.is_maker_ask === 'boolean' ? o.is_maker_ask : undefined,
  timestamp: num(o.timestamp),
  trade_id: o.trade_id !== undefined ? num(o.trade_id) : undefined,
});

/** Maintient un carnet local à partir du snapshot + deltas WS Lighter (size `0` = suppression). */
class BookState {
  private readonly bids = new Map<string, string>();
  private readonly asks = new Map<string, string>();

  reset(): void {
    this.bids.clear();
    this.asks.clear();
  }

  apply(side: 'bids' | 'asks', levels: JsonValue[]): void {
    const book = side === 'bids' ? this.bids : this.asks;
    for (const level of levels) {
      const obj = asObj(level);
      if (obj === undefined) {
        continue;
      }
      const price = String(obj.price);
      const size = String(obj.size);
      if (Number(size) === 0) {
        book.delete(price);
      } else {
        book.set(price, size);
      }
    }
  }

  levels(side: 'bids' | 'asks'): OrderBookLevel[] {
    const book = side === 'bids' ? this.bids : this.asks;
    const out = [...book.entries()].map(([price, size]) => ({ price, size, n: null }));
    out.sort((a, b) =>
      side === 'bids' ? Number(b.price) - Number(a.price) : Number(a.price) - Number(b.price),
    );
    return out;
  }
}

/**
 * Client WebSocket **unifié** Lighter : enveloppe {@link LighterWsClient} et convertit les
 * payloads natifs vers les types Blackcube. Lazy-connect hérité du client natif. Les méthodes
 * prennent le `marketId` (résolu par la façade depuis le `name`).
 */
export class UnifiedWsClient {
  private readonly ws: LighterWsClient;

  constructor(client: LighterClient, options: WsClientOptions = {}) {
    this.ws = new LighterWsClient(client, options);
  }

  /** Notifié à chaque erreur socket / message illisible (robustesse WS). */
  public set onError(cb: ((error: unknown) => void) | null) {
    this.ws.onError = cb;
  }
  /** Notifié à chaque fermeture de socket (avant une éventuelle reconnexion). */
  public set onClose(cb: (() => void) | null) {
    this.ws.onClose = cb;
  }
  /** Notifié après une reconnexion réussie (les abonnements ont été rejoués). */
  public set onReconnect(cb: (() => void) | null) {
    this.ws.onReconnect = cb;
  }

  /** Bougies temps réel (`candle/<id>/<resolution>`). Même shape que le REST → même converter. */
  subscribeCandles(
    marketId: number,
    name: string,
    interval: string,
    kind: MarketKind,
    cb: (candle: Candle) => void,
  ): Unsubscribe {
    const converter = new CandleConverter(name, interval, kind);
    return this.ws.subscribe(`candle/${marketId}/${interval}`, (msg) => {
      const obj = asObj(msg);
      for (const raw of asArr(obj?.candles)) {
        const c = asObj(raw);
        if (c !== undefined) {
          cb(converter.toCommon(toNativeCandle(c)));
        }
      }
    });
  }

  /** Carnet d'ordres temps réel (`order_book/<id>`), snapshot + deltas fusionnés. */
  subscribeOrderBook(
    marketId: number,
    name: string,
    kind: MarketKind,
    cb: (book: OrderBook) => void,
  ): Unsubscribe {
    const state = new BookState();
    return this.ws.subscribe(`order_book/${marketId}`, (msg) => {
      const obj = asObj(msg);
      const book = asObj(obj?.order_book);
      if (book === undefined) {
        return;
      }
      if (String(obj?.type).startsWith('subscribed')) {
        state.reset();
      }
      state.apply('asks', asArr(book.asks));
      state.apply('bids', asArr(book.bids));
      cb({
        name,
        kind,
        bids: state.levels('bids'),
        asks: state.levels('asks'),
        time:
          obj?.last_updated_at !== undefined
            ? Math.floor(Number(obj.last_updated_at) / 1000)
            : null,
      });
    });
  }

  /** Meilleure limite (BBO) dérivée du carnet temps réel. */
  subscribeBbo(
    marketId: number,
    name: string,
    kind: MarketKind,
    cb: (book: OrderBook) => void,
  ): Unsubscribe {
    return this.subscribeOrderBook(marketId, name, kind, (book) => {
      cb({
        name,
        kind,
        bids: book.bids.slice(0, 1),
        asks: book.asks.slice(0, 1),
        time: book.time,
      });
    });
  }

  /** Trades publics temps réel (`trade/<id>`), un callback par trade. */
  subscribeTrades(marketId: number, cb: (trade: Trade) => void): Unsubscribe {
    const converter = new TradeConverter();
    return this.ws.subscribe(`trade/${marketId}`, (msg) => {
      const obj = asObj(msg);
      for (const raw of asArr(obj?.trades)) {
        const t = asObj(raw);
        if (t !== undefined) {
          cb(converter.toCommon(toNativeTrade(t)));
        }
      }
    });
  }

  /** Stats de marché temps réel (`market_stats/<id>`) → {@link Price}. */
  subscribeMarketStats(
    marketId: number,
    name: string,
    kind: MarketKind,
    cb: (price: Price) => void,
  ): Unsubscribe {
    return this.ws.subscribe(`market_stats/${marketId}`, (msg) => {
      const obj = asObj(msg);
      const s = asObj(obj?.market_stats);
      if (s === undefined) {
        return;
      }
      const str = (v: JsonValue | undefined): string | null => (v !== undefined ? String(v) : null);
      cb({
        name,
        kind,
        mark: str(s.mark_price),
        oracle: str(s.index_price),
        mid: str(s.mid_price),
        bid: null,
        ask: null,
        last: str(s.last_trade_price),
        funding: str(s.current_funding_rate),
        openInterest: str(s.open_interest),
        volume24h: str(s.daily_quote_token_volume),
        prevDayPrice: null,
        time: null,
      });
    });
  }

  /**
   * Flux **privé** temps réel d'un compte (`account_all/<accountIndex>`, requiert `auth`).
   * Le callback reçoit le message brut ; le scope en extrait ordres/positions/trades.
   */
  subscribeAccountAll(
    accountIndex: number,
    auth: string,
    cb: (message: JsonValue) => void,
  ): Unsubscribe {
    return this.ws.subscribe(`account_all/${accountIndex}`, (msg) => cb(msg), { auth });
  }

  /** Ferme la socket sous-jacente. */
  close(): void {
    this.ws.close();
  }
}
