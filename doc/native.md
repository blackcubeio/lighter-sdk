# Surface `native` — spécifique à `@blackcube/lighter-sdk`

Capacités **propres à Lighter**, hors contrat unifié (voir [`common.md`](common.md) pour le portable).
Accès uniforme à tous les SDK : **`dex.native.<capacité>(label?)`**. Les noms d'interfaces (`ISigning`,
`IPools`, `IStaking`…) et de méthodes sont **alignés entre SDK** quand le geste existe ailleurs
(`create`/`update`/`deposit`/`get…`…) ; sinon descriptifs. Les types d'entrée portent le suffixe `Params`.

```ts
const dex = new Lighter({ desk: signer }, { default: 'desk' });
const token = await dex.native.signing().getAuthToken();
```

`label?` choisit le signer (défaut : signer par défaut). Les capacités natives sont **signées**
(signer WASM requis), sauf `signing().generate()` qui est purement local.

---

## `native.signing()` — `ISigning` (clés API + helpers de signature)
| Méthode | Entrée | Sortie |
|---|---|---|
| `generate()` | — | `Promise<{ privateKey; publicKey }>` (local, WASM) |
| `getNextNonce()` | — | `Promise<number>` |
| `getAuthToken(deadlineSeconds?)` | `number?` | `Promise<string>` |

```ts
await dex.native.signing().generate();
await dex.native.signing().getNextNonce();
await dex.native.signing().getAuthToken(3600);
```

## `native.subAccounts()` — `ISubAccountsAdmin` (création)
*(la **liste** des sous-comptes est dans le scope unifié `account().getSubAccounts()` ; verbe aligné `create`.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `create()` | — | `Promise<TxResult>` |

```ts
await dex.native.subAccounts().create();
```

> **Transferts** : `transfers()` est désormais un scope **commun** (`dex.transfers()`), plus dans
> `native`. Modèle unifié `transfer({ from?, to, asset?, amount })` — Lighter ne supporte que
> `to: { account: '<index>' }`. Voir `doc/common.md`.

## `native.pools()` — `IPools` (public pools / LP)
*(verbes alignés `create`/`update` + métier `mint`/`burn`.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `create(p)` | `CreatePublicPool` `{ operatorFee; initialTotalShares; minOperatorShareRate }` | `Promise<TxResult>` |
| `update(p)` | `UpdatePublicPool` `{ publicPoolIndex; status; operatorFee; minOperatorShareRate }` | `Promise<TxResult>` |
| `mint(p)` | `MintShares` `{ publicPoolIndex; shareAmount }` | `Promise<TxResult>` |
| `burn(p)` | `BurnShares` `{ publicPoolIndex; shareAmount }` | `Promise<TxResult>` |

```ts
await dex.native.pools().create({ operatorFee: 10, initialTotalShares: 1_000_000, minOperatorShareRate: 5 });
await dex.native.pools().update({ publicPoolIndex: 3, status: 1, operatorFee: 12, minOperatorShareRate: 5 });
await dex.native.pools().mint({ publicPoolIndex: 3, shareAmount: 1000 });
await dex.native.pools().burn({ publicPoolIndex: 3, shareAmount: 500 });
```

## Surplus ordres — `INativeOrders`, porté par `perp()` / `spot()` (ordres groupés, TX 28)
*(pas de scope `native` dédié : exposé sur le scope marché. Verbe aligné `placeBatch` ; `groupingType` :
0 = lot indépendant, autres = OCO/bracket. La façade résout marché + scaling par leg.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `placeBatch(orders, groupingType?)` | `GroupedOrder[]` `{ name; side; type; size; price; tif?; reduceOnly?; triggerPrice?; clientId? }` | `Promise<TxResult>` |

```ts
await dex.perp().placeBatch([
  { name: 'BTC', side: 'buy', type: 'limit', size: '0.001', price: '30000', tif: 'alo' },
  { name: 'BTC', side: 'buy', type: 'limit', size: '0.001', price: '29000', tif: 'alo' },
]);
```

## `native.marketData()` — `INativeMarket` (données de marché publiques)
| Méthode | Entrée | Sortie |
|---|---|---|
| `getFundingRates()` | — | `Promise<{ funding_rates }>` (taux courants par marché/exchange) |

```ts
await dex.native.marketData().getFundingRates();
```

## `native.account()` — `INativeAccount` (lectures + config de compte authentifiées)
*(`accountIndex` + token `auth` injectés par le scope. Absorbe l'ex-`accountConfig`.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `getLiquidations(q?)` | `{ limit?; marketId? }` | `Promise<{ liquidations }>` |
| `getPositionFunding(q?)` | `{ limit?; marketId? }` | `Promise<{ position_fundings }>` |
| `getPnl(q)` | `PnlParams` `{ resolution; startTime; endTime; countBack?; ignoreTransfers? }` | `Promise<{ pnl }>` |
| `updateSettings(p)` | `UpdateSettingsParams` `{ accountTradingMode }` | `Promise<TxResult>` |
| `updateAssetConfig(p)` | `UpdateAssetConfigParams` `{ assetIndex; assetMarginMode }` | `Promise<TxResult>` |

```ts
await dex.native.account().getLiquidations({ limit: 20 });
await dex.native.account().getPositionFunding({ marketId: 1, limit: 20 });
await dex.native.account().getPnl({ resolution: '1h', startTime: Date.now() - 7 * 86_400_000, endTime: Date.now() });
await dex.native.account().updateSettings({ accountTradingMode: 1 });
await dex.native.account().updateAssetConfig({ assetIndex: 0, assetMarginMode: 1 });
```

## `native.staking()` — `IStaking` (deposit / withdraw)
*(verbes alignés `deposit`/`withdraw`, comme HL.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `deposit(p)` | `StakingDepositParams` `{ stakingPoolIndex; shareAmount }` | `Promise<TxResult>` |
| `withdraw(p)` | `StakingWithdrawParams` `{ stakingPoolIndex; shareAmount }` | `Promise<TxResult>` |

```ts
await dex.native.staking().deposit({ stakingPoolIndex: 0, shareAmount: 1000 });
await dex.native.staking().withdraw({ stakingPoolIndex: 0, shareAmount: 500 });
```

---

> **Validation** (`tests/native.testnet.test.ts`, testnet réel) :
> - **testé** : `signing` (generate/getNextNonce/getAuthToken), `perp().placeBatch` (chemin TX 28
>   signé — WASM officiel), `marketData.getFundingRates` (public), `account` (getLiquidations/
>   getPositionFunding/getPnl, authentifiés).
> - **préparées + documentées, testées manuellement** (écritures à effet de bord / création de ressource) :
>   `subAccounts.create`, `transfers().transfer` (commun), `pools.*`, `staking.deposit/withdraw`,
>   `account.updateSettings/updateAssetConfig`.
