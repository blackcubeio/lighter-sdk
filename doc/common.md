# Surface commune (unifiée) — identique sur les 4 SDK Blackcube

Cette page décrit le **contrat unifié** partagé par `@blackcube/aster-sdk`, `@blackcube/hyperliquid-sdk`,
`@blackcube/pacifica-sdk` et `@blackcube/lighter-sdk`. **Elle est identique d'un SDK à l'autre** (copiée).
Le spécifique à chaque DEX est dans [`native.md`](native.md).

> **Ségrégation par capacité** : une méthode/un scope n'existe que si le DEX l'offre réellement
> (jamais de `throw "non supporté"`). Le tableau de chaque scope indique les absences connues.
> Les prix/quantités sont des **chaînes décimales** ; `xtras` porte le natif hors cœur (rien n'est jeté).

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
| `getCandles(q)` | `CandlesQuery` | `Promise<Candle[]>` |
| `getOrderBook(q)` | `OrderBookQuery` | `Promise<OrderBook>` |
| `getPrices()` | — | `Promise<Price[]>` |
| `getFundingHistory(q)` | `FundingQuery` | `Promise<FundingRate[]>` |

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
| `getTrades(q)` | `TradesQuery` | `Promise<Trade[]>` |

```ts
await dex.perp().getTrades({ name: 'BTC', limit: 50 });
```

### Compte du produit — `IProductAccount` / `IOrderHistory`
| Méthode | Entrée | Sortie |
|---|---|---|
| `getPositions(q?)` | `SymbolQuery?` | `Promise<Position[]>` |
| `getOpens(q?)` | `SymbolQuery?` | `Promise<Order[]>` |
| `getUserTrades(q?)` | `SymbolQuery?` | `Promise<UserTrade[]>` |
| `getAccountInfo()` | — | `Promise<unknown>` |
| `getHistory(q?)` | `SymbolQuery?` | `Promise<Order[]>` |

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
| `place(i)` | `PlaceOrderInput` | `Promise<Order>` |
| `cancel(i)` | `CancelOrderInput` | `Promise<void>` |
| `cancelAll(i)` | `CancelAllInput` | `Promise<{ cancelled: number \| null }>` |
| `edit(i)` | `EditOrderInput` | `Promise<{ name: string; id: string }>` |
| `updateLeverage(i)` | `LeverageInput` | `Promise<unknown>` |

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
| `setMarginMode(i)` | `MarginModeInput` | `Promise<void>` |
| `addIsolatedMargin(i)` | `IsolatedMarginInput` | `Promise<void>` |
| `removeIsolatedMargin(i)` | `IsolatedMarginInput` | `Promise<void>` *(absent : Pacifica)* |

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
| `withdraw(i)` | `WithdrawInput` | `Promise<unknown>` |
| `getSubAccounts()` | — | `Promise<SubAccount[]>` *(absent : HL)* |
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
Modèle **unifié** : `transfer({ from?, to, asset?, amount })`. Chaque extrémité est un `TransferEndpoint` :
`{ wallet: 'perp' | 'spot' }` · `{ account: string }` · `{ subAccount: string }`. La façade route vers
l'endpoint natif selon `(from, to)` ; une route non supportée lève une erreur explicite.

| Méthode | Entrée | Sortie |
|---|---|---|
| `transfer(p)` | `TransferParams` `{ from?: TransferEndpoint; to: TransferEndpoint; asset?: string; amount: string }` | `Promise<unknown>` |

Routes **Lighter** : `to: { account: '<index>' }` uniquement (transfert de collatéral vers un autre
compte par index ; `amount` en USDC).

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

## `helpers()` — dérivation de clés
### `KeyHelper` (+ `EvmHelper` / `SolanaHelper` selon le DEX)
| `keyTypeOf(pk)` | `string` | `'evm' \| 'solana'` |
| `privateKeyToAddress(pk)` | `string` | `string` *(EVM)* |
| `toChecksumAddress(addr)` | `string` | `string` *(EVM)* |
| `solanaAddress(pk)` | `string` | `string` *(Solana)* |
| `signEd25519(msg, pk)` | `string, string` | `string` *(Solana)* |

```ts
dex.helpers().keyTypeOf('0xabc…'); // 'evm'
```

---

## Types — entrées (Input)

```ts
interface CandlesQuery   { name: string; interval: string; startTime?: number; endTime?: number; limit?: number }
interface OrderBookQuery { name: string; limit?: number }
interface TradesQuery    { name: string; limit?: number }
interface FundingQuery   { name: string; startTime?: number; endTime?: number; limit?: number }
interface SymbolQuery    { name: string }

interface PlaceOrderInput {
  name: string; side: 'buy' | 'sell';
  type: 'limit' | 'market' | 'stop' | 'stopMarket' | 'takeProfit' | 'takeProfitMarket';
  size: string; price?: string; triggerPrice?: string;
  tif?: 'gtc' | 'ioc' | 'fok' | 'alo'; reduceOnly?: boolean; clientId?: string;
}
interface CancelOrderInput   { name: string; id?: string; clientId?: string }
interface CancelAllInput     { name: string }
interface EditOrderInput     { name: string; id?: string; clientId?: string; side: 'buy' | 'sell'; size: string; price?: string }
interface LeverageInput      { name: string; leverage: number }
interface MarginModeInput    { name: string; isolated: boolean }
interface IsolatedMarginInput{ name: string; amount: string }
interface WithdrawInput      { amount: string; address?: string; asset?: string; [extra: string]: unknown }
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
