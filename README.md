# @blackcube/lighter-sdk

SDK TypeScript pour l'échange **Lighter** (DEX perp orderbook, zk-rollup). Même **moule** que les
autres SDK Blackcube (Aster / Hyperliquid / Pacifica) : une classe façade, des **scopes** par
capacité, des **types unifiés** identiques entre SDK, et un **client isolé** par instance (pas de
singleton global). La signature passe par le **signer WASM officiel** Lighter, vendoré et bootté
en lazy.

```ts
import { Lighter } from '@blackcube/lighter-sdk';

// Lectures publiques : aucun signer requis.
const dex = new Lighter();
const pairs = await dex.perp().getPairs();
const book = await dex.perp().getOrderBook({ name: 'BTC', limit: 20 });

// Temps réel (lazy-connect, auto-close au dernier unsubscribe).
const unsub = dex.ws().subscribeOrderBook({ name: 'BTC' }, (b) => console.log(b.bids[0]));
```

Avec un signer (trading, lectures privées) :

```ts
const dex = new Lighter(
  {
    desk: {
      apiPrivateKey: process.env.LIGHTER_API_PRIVATE_KEY!, // clé API Lighter (courbe maison)
      apiKeyIndex: 4, // 0–1 réservés (web/mobile), 2–254 custom
      accountIndex: 123456, // index du compte L2
      network: 'testnet', // écritures sur testnet
      l1Address: '0x…', // requis pour getSubAccounts
    },
  },
  { default: 'desk' },
);

await dex.perp().placeOrder({ name: 'BTC', side: 'buy', type: 'limit', size: '0.001', price: '50000' });
await dex.perp().cancelAllOrders({ name: 'BTC' });
const positions = await dex.perp().getPositions();
```

## Modèle

`new Lighter(signers, { default })` construit un **client isolé** ; plusieurs instances
(comptes / réseaux) coexistent sans état partagé. Le signer WASM est instancié **une fois par
réseau** (lazy), donc des signers mainnet et testnet coexistent isolés (cf.
[doc/signing.md](doc/signing.md)). `label` absent ⇒ signer par défaut.

| Scope | Rôle |
|---|---|
| `perp(label?)` / `spot(label?)` | Marché (perp ou spot) + trading + compte du produit |
| `account(label?)` | Transverse : `getBalances` (tous les actifs spot), `getSubAccounts`, `withdraw` |
| `ws(label?)` / `wsSpot(label?)` | Temps réel (perp ou spot) : carnet, trades, bougies, BBO, prix, ordres/positions/fills |
| `apiKeys(label?)` | `generateApiKey`, `getNextNonce`, `getAuthToken` (spécifique Lighter) |
| `subAccounts(label?)` | `createSubAccount` (spécifique Lighter) |
| `transfers(label?)` | `transfer` de collatéral entre comptes (spécifique Lighter) |
| `pools(label?)` | public pools / LP : `createPublicPool`, `updatePublicPool`, `mintShares`, `burnShares` |
| `staking(label?)` | `stakeAssets`, `unstakeAssets` |
| `accountConfig(label?)` | `updateAccountConfig` (mode de trading), `updateAccountAssetConfig` (actif comme marge) |

> Non surfacés : `changePubKey` et `approveIntegrator` exigent une **signature L1 EVM** du
> `messageToSign` que le `.wasm` vendoré ne permet pas de réinjecter dans la transaction — à
> implémenter avec le flux L1 dédié (et un test prudent : `changePubKey` fait tourner la clé).

Lighter expose des marchés **perp et spot** (`market_type`) → scopes `perp()`/`spot()` (même
classe paramétrée par `kind`, comme Aster). Pas de scope `system()` : aucun endpoint ping/horloge
dédié, et les lectures de compte (positions, soldes, infos) sont **publiques par index**.

### Capacités des scopes `perp()` / `spot()`

- **Marché** : `getPairs`, `getCandles`, `getOrderBook`, `getPrices`, `getFundingHistory`,
  `getExchangeInfo`, `getTrades`.
- **Compte du produit** : `getPositions`, `getOpenOrders`, `getUserTrades`, `getAccountInfo`,
  `getOrderHistory`.
- **Trading** : `placeOrder` (limit/market), `cancelOrder`, `cancelAllOrders`, `editOrder`,
  `updateLeverage`, `setMarginMode`, `addIsolatedMargin`, `removeIsolatedMargin`.

`setMarginMode` n'a pas d'endpoint dédié côté Lighter : la façade le traduit en interne via
`UpdateLeverage(marginMode)` (mécanique cachée, comme Hyperliquid).

## REST vs WebSocket

- **REST** : lectures de marché et de compte, et envoi des transactions signées (`/sendTx`).
- **WebSocket** (`wss://…/stream`) : flux temps réel. Le client est **lazy** (ouverture au 1er
  abonnement, fermeture au dernier) et bufferise les souscriptions avant l'ouverture.

> Note : l'endpoint REST `/candlesticks` peut renvoyer **403** selon le réseau d'origine (WAF
> CloudFront). Le **flux WS de bougies** (`dex.ws().subscribeCandles`) fonctionne dans tous les cas.

## Réseaux

| | mainnet | testnet |
|---|---|---|
| REST | `https://mainnet.zklighter.elliot.ai` | `https://testnet.zklighter.elliot.ai` |
| WS | `wss://mainnet.zklighter.elliot.ai/stream` | `wss://testnet.zklighter.elliot.ai/stream` |

Surchargeables via `new Lighter(signers, { restUrls, wsUrls })`.

## Signer WASM

La signature Lighter (ordres, marge, retraits, token d'auth) utilise la lib crypto officielle
`lighter-go` compilée en WebAssembly, **vendorée** dans `wasm/`. Voir [doc/signing.md](doc/signing.md)
pour le modèle de clés, le bootstrap lazy et la régénération du binaire.

## Développement

```sh
pnpm install
pnpm build:wasm   # régénère wasm/ depuis lighter-go (nécessite Go)
pnpm typecheck
pnpm test         # tests réels (mainnet en lecture ; trading testnet si creds en env)
pnpm build
```
