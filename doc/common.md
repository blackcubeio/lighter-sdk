# Surface commune (unifiée) — partagée par les 4 SDK Blackcube

Cette page décrit le **contrat unifié** partagé par `@blackcube/aster-sdk`, `@blackcube/hyperliquid-sdk`,
`@blackcube/pacifica-sdk` et `@blackcube/lighter-sdk`. L'**invariant** : mêmes **scopes**, mêmes **noms**,
même **vocabulaire** et mêmes **formes de types** (`…Params` en entrée, types de sortie communs) d'un SDK à
l'autre. Deux natures de **divergence assumée par conception**, toujours **annotées au cas par cas** dans les
tableaux/sections :

1. **Disponibilité par capacité** — un scope ou une méthode n'existe que si le DEX l'offre réellement
   (jamais de `throw « non supporté »` ; absences notées `*(absent : …)*`).
2. **Narrowing de type par DEX** — quand une venue n'accepte qu'une partie d'une entrée, le **type** est
   restreint à ce qu'elle supporte (le compilateur refuse le reste, aucun `throw` au runtime). Ex. : la/les
   route(s) de `transfer()`, ou le `type` d'ordre de `place()`. Cf. la section concernée.

> Les prix/quantités sont des **chaînes décimales** ; `xtras` porte le natif hors cœur (rien n'est jeté).

Le spécifique à chaque DEX est dans [`native.md`](native.md).

## Construction

```ts
import { Aster } from '@blackcube/aster-sdk'; // ou Hyperliquid / Pacifica / Lighter
const dex = new Aster({ desk: signer }, { default: 'desk' });
// label absent → signer par défaut. Lectures publiques : new Aster() suffit (sans signer).
```

`name` = identifiant de paire **du DEX** (ex. `BTC`, `BTCUSDT`). `interval` = `1m/5m/1h/1d…`.

---

## `perp(label?)` / `spot(label?)` — marché + trading + compte du produit
*(le `kind` perp/spot est porté par le scope ; Lighter/Pacifica n'ont pas tous `spot()`.)*

### Données de marché — `IMarketData`
| Méthode | Entrée | Sortie |
|---|---|---|
| `getPairs()` | — | `Promise<Pair[]>` |
| `getCandles(q)` | `CandlesParams` | `Promise<Candle[]>` |
| `getOrderBook(q)` | `OrderBookParams` | `Promise<OrderBook>` |
| `getPrices()` | — | `Promise<Price[]>` |
| `getFundingHistory(q)` | `FundingParams` | `Promise<FundingRate[]>` |

```ts
await dex.perp().getPairs();
await dex.perp().getCandles({ name: 'BTC', interval: '1h', limit: 100 });
await dex.perp().getOrderBook({ name: 'BTC', limit: 20 });
await dex.perp().getPrices();
await dex.perp().getFundingHistory({ name: 'BTC', limit: 50 });
```

### Métadonnées — `IMarketMeta`
| `getExchangeInfo()` | — | `Promise<unknown>` (natif brut) |

```ts
await dex.perp().getExchangeInfo();
```

### Trades publics — `IPublicTrades`
| `getTrades(q)` | `TradesParams` | `Promise<Trade[]>` |

```ts
await dex.perp().getTrades({ name: 'BTC', limit: 50 });
```

### Compte du produit — `IProductAccount` / `IOrderHistory`
| Méthode | Entrée | Sortie |
|---|---|---|
| `getPositions(q?)` | `SymbolParams?` | `Promise<Position[]>` |
| `getOpens(q?)` | `SymbolParams?` | `Promise<Order[]>` |
| `getUserTrades(q?)` | `SymbolParams?` | `Promise<UserTrade[]>` |
| `getAccountInfo()` | — | `Promise<unknown>` |
| `getHistory(q?)` | `SymbolParams?` | `Promise<Order[]>` |

```ts
await dex.perp().getPositions();
await dex.perp().getOpens({ name: 'BTC' });
await dex.perp().getUserTrades({ name: 'BTC' });
await dex.perp().getAccountInfo();
await dex.perp().getHistory({ name: 'BTC' });
```

### Trading — `ITrading`
| Méthode | Entrée | Sortie |
|---|---|---|
| `place(i)` | `PlaceOrderParams` | `Promise<Order>` |
| `cancel(i)` | `CancelOrderParams` | `Promise<void>` |
| `cancelAll(i)` | `CancelAllParams` | `Promise<{ cancelled: number \| null }>` |
| `edit(i)` | `EditOrderParams` | `Promise<{ name: string; id: string }>` |
| `updateLeverage(i)` | `LeverageParams` | `Promise<unknown>` |

```ts
await dex.perp().place({ name: 'BTC', side: 'buy', type: 'limit', size: '0.001', price: '50000' });
await dex.perp().cancel({ name: 'BTC', id: '12345' });
await dex.perp().cancelAll({ name: 'BTC' });
await dex.perp().edit({ name: 'BTC', id: '12345', side: 'buy', size: '0.002', price: '49000' });
await dex.perp().updateLeverage({ name: 'BTC', leverage: 10 });
```

### Marge — `IMarginMode` / `IIsolatedMargin` / `IRemovableMargin`
| Méthode | Entrée | Sortie |
|---|---|---|
| `setMarginMode(i)` | `MarginModeParams` | `Promise<void>` |
| `addIsolatedMargin(i)` | `IsolatedMarginParams` | `Promise<void>` |
| `removeIsolatedMargin(i)` | `IsolatedMarginParams` | `Promise<void>` *(absent : Pacifica)* |

```ts
await dex.perp().setMarginMode({ name: 'BTC', isolated: true });
await dex.perp().addIsolatedMargin({ name: 'BTC', amount: '50' });
await dex.perp().removeIsolatedMargin({ name: 'BTC', amount: '50' });
```

---

## `account(label?)` — transverse
### `IAccount` / `ISubAccounts` / `IDeadManSwitch`
| Méthode | Entrée | Sortie |
|---|---|---|
| `getBalances()` | — | `Promise<Balance[]>` |
| `withdraw(i)` | `WithdrawParams` | `Promise<TxResult>` (hash + enveloppe brute ; `TxResult` défini dans [`native.md`](native.md)) |
| `getSubAccounts()` | — | `Promise<SubAccount[]>` *(absent du scope commun HL ; HL l'expose via `dex.native.subAccounts().getList()`)* |
| `armCancelAll(afterMs)` | `number` | `Promise<unknown>` *(absent : Pacifica)* |
| `disarm()` | — | `Promise<unknown>` *(absent : Pacifica)* |

```ts
await dex.account().getBalances();
await dex.account().withdraw({ amount: '100' });
await dex.account().getSubAccounts();
await dex.account().armCancelAll(60_000); // dead-man-switch : annule tout dans 60 s sauf rafraîchi
await dex.account().disarm();
```

---

## `transfers(label?)` — transferts de fonds (commun)
`TransferParams` est **narrowé pour Lighter** : la seule route est vers un autre **compte** par index.
Le **type** l'impose (`to: { account: string }`) → le compilateur refuse toute autre route, **aucun
throw** « non supporté » au runtime.

| Méthode | Entrée | Sortie |
|---|---|---|
| `transfer(p)` | `TransferParams` `{ to: { account: string }; amount: string }` | `Promise<unknown>` |

`to.account` = **index de compte** (string) ; `amount` en USDC (collatéral).

```ts
await dex.transfers().transfer({ to: { account: '42' }, amount: '10.5' });
```

---

## `ws(label?)` / `wsSpot(label?)` — temps réel
Lazy-connect au 1er abonnement, fermeture au dernier ; chaque méthode renvoie un `Unsubscribe`.
### `IRealtime` / `IRealtimePositions`
| Méthode | Entrée | Callback |
|---|---|---|
| `subscribeCandles(q, cb)` | `{ name; interval }` | `(c: Candle) => void` |
| `subscribeOrderBook(q, cb)` | `{ name }` | `(b: OrderBook) => void` |
| `subscribeTrades(q, cb)` | `{ name }` | `(t: Trade) => void` |
| `subscribeBbo(q, cb)` | `{ name }` | `(b: OrderBook) => void` |
| `subscribePrices(cb)` | — | `(p: Price[]) => void` |
| `subscribeOrders(cb)` | — | `(o: Order) => void` |
| `subscribeUserTrades(cb)` | — | `(t: UserTrade) => void` |
| `subscribePositions(cb)` | — | `(p: Position) => void` *(absent : HL)* |

```ts
const off = dex.ws().subscribeOrderBook({ name: 'BTC' }, (b) => console.log(b.bids[0]));
dex.ws().subscribeCandles({ name: 'BTC', interval: '1m' }, (c) => console.log(c.c));
dex.ws().subscribeTrades({ name: 'BTC' }, (t) => console.log(t.price));
dex.ws().subscribeBbo({ name: 'BTC' }, (b) => console.log(b.asks[0]));
dex.ws().subscribePrices((prices) => console.log(prices.length));
dex.ws().subscribeOrders((o) => console.log(o.status));
dex.ws().subscribeUserTrades((t) => console.log(t.id));
dex.ws().subscribePositions((p) => console.log(p.size));
off(); // se désabonne
```

---

## `system()` — connectivité *(absent : HL, Pacifica, Lighter)*
### `ISystem`
| `ping()` | — | `Promise<void>` |
| `getServerTime()` | — | `Promise<number>` (ms) |

```ts
await dex.system().ping();
await dex.system().getServerTime();
```

---

## Types — entrées (Input)

```ts
// startTime/endTime : datetime UTC "YYYY-MM-DD HH:MM:SS" (string).
interface CandlesParams   { name: string; interval: string; startTime?: string; endTime?: string; limit?: number }
interface OrderBookParams { name: string; limit?: number }
interface TradesParams    { name: string; limit?: number }
interface FundingParams   { name: string; startTime?: string; endTime?: string; limit?: number }
interface SymbolParams    { name: string }

interface PlaceOrderParams {
  name: string; side: 'buy' | 'sell';
  type: 'limit' | 'market' | 'stop' | 'stopMarket' | 'takeProfit' | 'takeProfitMarket';
  size: string; price?: string; triggerPrice?: string;
  tif?: 'gtc' | 'ioc' | 'fok' | 'alo'; reduceOnly?: boolean; clientId?: string;
}
interface CancelOrderParams   { name: string; id?: string; clientId?: string }
interface CancelAllParams     { name: string }
interface EditOrderParams     { name: string; id?: string; clientId?: string; side: 'buy' | 'sell'; size: string; price?: string }
interface LeverageParams      { name: string; leverage: number }
interface MarginModeParams    { name: string; isolated: boolean }
interface IsolatedMarginParams{ name: string; amount: string }
interface WithdrawParams      { amount: string; address?: string; asset?: string; [extra: string]: unknown }
```

## Types — sorties (Output)

```ts
type Side = 'buy' | 'sell';
type MarketKind = 'perp' | 'spot';

interface Pair { name: string; base: string; quote: string; kind: MarketKind; szDecimals: number;
  maxLeverage?: number; tickSize?: string; stepSize?: string; minNotional?: string; status?: string; xtras?: Record<string, unknown> }

interface Candle { t: number; T: number; s: string; i: string; o: string; c: string; h: string; l: string;
  v: string; n: number; kind: MarketKind; qv: string | null; tbbv: string | null; tbqv: string | null; xtras?: Record<string, unknown> }

interface OrderBookLevel { price: string; size: string; n: number | null }
interface OrderBook { name: string; kind: MarketKind; bids: OrderBookLevel[]; asks: OrderBookLevel[]; time: number | null; xtras?: Record<string, unknown> }

interface Price { name: string; kind: MarketKind; mark: string | null; oracle: string | null; mid: string | null;
  bid: string | null; ask: string | null; last: string | null; funding: string | null; openInterest: string | null;
  volume24h: string | null; prevDayPrice: string | null; time: number | null; xtras?: Record<string, unknown> }

interface FundingRate { name: string; fundingRate: string; time: number; xtras?: Record<string, unknown> }

interface Trade { price: string; size: string; side: Side | null; maker: boolean | null; time: number; id: number | null; xtras?: Record<string, unknown> }

interface Order { name: string; kind: MarketKind; id: string; clientId: string | null; side: Side;
  type: 'limit' | 'market' | 'stop' | 'stopMarket' | 'takeProfit' | 'takeProfitMarket' | 'trailingStop' | 'other';
  price: string | null; size: string; filled: string;
  status: 'open' | 'partiallyFilled' | 'filled' | 'canceled' | 'rejected' | 'expired' | 'other';
  tif: 'gtc' | 'ioc' | 'fok' | 'alo' | null; reduceOnly: boolean | null; time: number; xtras?: Record<string, unknown> }

interface Position { name: string; side: 'long' | 'short' | null; size: string; entryPrice: string | null;
  markPrice: string | null; unrealizedPnl: string | null; leverage: number | null; liquidationPrice: string | null;
  margin: string | null; xtras?: Record<string, unknown> }

interface UserTrade { name: string; kind: MarketKind; id: string; orderId: string; side: Side; price: string; size: string;
  fee: string; feeAsset: string | null; pnl: string | null; maker: boolean | null; time: number; xtras?: Record<string, unknown> }

interface Balance { asset: string; total: string; available: string | null; usdValue: string | null; xtras?: Record<string, unknown> }

interface SubAccount { address: string; xtras?: Record<string, unknown> }

type Unsubscribe = () => void;
```

> Les types **natifs** (`TxResult`, `Liquidation`, `PositionFundingEntry`, `PnlPoint`…) n'appartiennent
> pas au commun : ils sont documentés dans [`native.md`](native.md) (namespace `native`).
