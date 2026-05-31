# Surface `native` — spécifique à `@blackcube/lighter-sdk`

Capacités **propres à Lighter**, hors contrat unifié (voir [`common.md`](common.md) pour le portable).
Accès uniforme à tous les SDK : **`dex.native.<capacité>(label?)`**. Les noms d'interfaces (`IApiKeys`,
`ITransfers`, `IPools`…) et de méthodes sont **alignés entre SDK** quand le geste existe ailleurs
(`create`/`update`/`transfer`…) ; sinon descriptifs. Les types d'entrée portent des **noms de concept
propres** (sans suffixe `Input`/`Params`).

```ts
const dex = new Lighter({ desk: signer }, { default: 'desk' });
const token = await dex.native.apiKeys().authToken();
```

`label?` choisit le signer (défaut : signer par défaut). Les capacités natives sont **signées**
(signer WASM requis), sauf `apiKeys().generate()` qui est purement local.

---

## `native.apiKeys()` — `IApiKeys` (clés API + helpers de signature)
| Méthode | Entrée | Sortie |
|---|---|---|
| `generate()` | — | `Promise<{ privateKey; publicKey }>` (local, WASM) |
| `nextNonce()` | — | `Promise<number>` |
| `authToken(deadlineSeconds?)` | `number?` | `Promise<string>` |

```ts
await dex.native.apiKeys().generate();
await dex.native.apiKeys().nextNonce();
await dex.native.apiKeys().authToken(3600);
```

## `native.subAccounts()` — `ISubAccountsAdmin` (création)
*(la **liste** des sous-comptes est dans le scope unifié `account().getSubAccounts()` ; verbe aligné `create`.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `create()` | — | `Promise<TxResult>` |

```ts
await dex.native.subAccounts().create();
```

## `native.transfers()` — `ITransfers` (transfert de collatéral entre comptes)
| Méthode | Entrée | Sortie |
|---|---|---|
| `transfer(input)` | `Transfer` `{ toAccountIndex; amount; memo? }` | `Promise<TxResult>` |

```ts
await dex.native.transfers().transfer({ toAccountIndex: 42, amount: '10.5' });
```

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

## `native.advancedOrders()` — `IAdvancedOrders` (ordres groupés, TX 28)
*(verbe aligné `placeBatch` ; `groupingType` : 0 = lot indépendant, autres = OCO/bracket. La façade résout marché + scaling par leg.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `placeBatch(orders, groupingType?)` | `GroupedOrder[]` `{ name; side; type; size; price; tif?; reduceOnly?; triggerPrice?; clientId? }` | `Promise<TxResult>` |

```ts
await dex.native.advancedOrders().placeBatch([
  { name: 'BTC', side: 'buy', type: 'limit', size: '0.001', price: '30000', tif: 'alo' },
  { name: 'BTC', side: 'buy', type: 'limit', size: '0.001', price: '29000', tif: 'alo' },
]);
```

## `native.marketData()` — `IMarketDataExtra` (données de marché publiques)
| Méthode | Entrée | Sortie |
|---|---|---|
| `fundingRates()` | — | `Promise<{ funding_rates }>` (taux courants par marché/exchange) |

```ts
await dex.native.marketData().fundingRates();
```

## `native.account()` — `IAccountExtra` (lectures de compte authentifiées)
*(`accountIndex` + token `auth` injectés par le scope.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `liquidations(q?)` | `{ limit?; marketId? }` | `Promise<{ liquidations }>` |
| `positionFunding(q?)` | `{ limit?; marketId? }` | `Promise<{ position_fundings }>` |
| `pnl(q)` | `{ resolution; startTime; endTime; countBack?; ignoreTransfers? }` | `Promise<{ pnl }>` |

```ts
await dex.native.account().liquidations({ limit: 20 });
await dex.native.account().positionFunding({ marketId: 1, limit: 20 });
await dex.native.account().pnl({ resolution: '1h', startTime: Date.now() - 7 * 86_400_000, endTime: Date.now() });
```

## `native.staking()` — `IStaking` (stake / unstake)
| Méthode | Entrée | Sortie |
|---|---|---|
| `stake(p)` | `Stake` `{ stakingPoolIndex; shareAmount }` | `Promise<TxResult>` |
| `unstake(p)` | `Unstake` `{ stakingPoolIndex; shareAmount }` | `Promise<TxResult>` |

```ts
await dex.native.staking().stake({ stakingPoolIndex: 0, shareAmount: 1000 });
await dex.native.staking().unstake({ stakingPoolIndex: 0, shareAmount: 500 });
```

## `native.accountConfig()` — `IAccountConfig` (mode de trading, marge par actif)
*(verbe aligné `update`.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `update(p)` | `UpdateAccountConfig` `{ accountTradingMode }` | `Promise<TxResult>` |
| `updateAsset(p)` | `UpdateAccountAssetConfig` `{ assetIndex; assetMarginMode }` | `Promise<TxResult>` |

```ts
await dex.native.accountConfig().update({ accountTradingMode: 1 });
await dex.native.accountConfig().updateAsset({ assetIndex: 0, assetMarginMode: 1 });
```

---

> **Validation** (`tests/native.testnet.test.ts`, testnet réel) :
> - **testé** : `apiKeys` (generate/nextNonce/authToken), `advancedOrders.placeBatch` (chemin TX 28
>   signé — WASM officiel), `marketData.fundingRates` (public), `account` (liquidations/positionFunding/pnl,
>   authentifiés).
> - **préparées + documentées, testées manuellement** (écritures à effet de bord / création de ressource) :
>   `subAccounts.create`, `transfers.transfer`, `pools.*`, `staking.*`, `accountConfig.*`.
