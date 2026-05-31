# Surface `native` — spécifique à `@blackcube/lighter-sdk`

Capacités **propres à Lighter**, hors contrat unifié (voir [`common.md`](common.md) pour le portable).
Accès **`dex.native.<capacité>(label?)`**. Le namespace `native` **miroite** le commun :

| commun (portable) | natif (spécifique) |
|---|---|
| `dex.perp()` | `dex.native.perp()` — funding-rates + ordres groupés (TX 28) |
| `dex.account()` | `dex.native.account()` — lectures étendues + config de compte |
| `dex.transfers()` | — (narrowé `to:{account}`) |

Capacités **sans équivalent commun** : `native.signing()`, `native.subAccounts()`, `native.pools()`,
`native.staking()`. Types d'entrée en `…Params`.

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

> **Transferts** : `transfers()` est un scope **commun** (`dex.transfers()`), pas dans `native`.
> `TransferParams` est **narrowé** à `to: { account: '<index>' }` (collatéral USDC) — le compilateur
> refuse toute autre route. Voir `doc/common.md`.

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

## `native.perp()` — `INativePerp` (miroir natif de `perp()`)
Surplus **perp** : lecture marché supplémentaire (publique) **+** ordres groupés (TX 28). Hors
contrat portable. (`groupingType` : 0 = lot indépendant, autres = OCO/bracket ; la façade résout
marché + scaling par leg.)

| Méthode | Entrée | Sortie |
|---|---|---|
| `getFundingRates()` | — | `Promise<FundingRate[]>` (type commun ; taux **courants** par marché, public ; `exchange` en `xtras`) |
| `placeBatch(orders, groupingType?)` | `GroupedOrder[]` `{ name; side; type; size; price; tif?; reduceOnly?; triggerPrice?; clientId? }` | `Promise<Order[]>` (type commun, 1 `Order` par leg ; `id` vide / `status: 'open'`, `txHash` en `xtras` — TX 28 ne renvoie pas de statut par leg) |

```ts
await dex.native.perp().getFundingRates();
await dex.native.perp().placeBatch([
  { name: 'BTC', side: 'buy', type: 'limit', size: '0.001', price: '30000', tif: 'alo' },
  { name: 'BTC', side: 'buy', type: 'limit', size: '0.001', price: '29000', tif: 'alo' },
]);
```

## `native.account()` — `INativeAccount` (lectures + config de compte authentifiées)
*(`accountIndex` + token `auth` injectés par le scope. Absorbe l'ex-`accountConfig`.)*
| Méthode | Entrée | Sortie |
|---|---|---|
| `getLiquidations(q?)` | `{ limit?; marketId? }` | `Promise<Liquidation[]>` (interface dédiée : `name`/`id`/`side`/`size`/`price`/`fee`/`type`/`time`) |
| `getPositionFunding(q?)` | `{ limit?; marketId? }` | `Promise<PositionFundingEntry[]>` (interface dédiée : `name`/`side`/`size`/`fundingRate`/`pnl`/`time`) |
| `getPnl(q)` | `PnlParams` `{ resolution; startTime; endTime; countBack?; ignoreTransfers? }` | `Promise<PnlPoint[]>` (interface dédiée : `time`/`pnl` ; composantes pool/staking/volume en `xtras`) |
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
> - **testé** : `signing` (generate/getNextNonce/getAuthToken), `native.perp().placeBatch` (chemin TX 28
>   signé — WASM officiel), `native.perp().getFundingRates` (public), `account` (getLiquidations/
>   getPositionFunding/getPnl, authentifiés).
> - **préparées + documentées, testées manuellement** (écritures à effet de bord / création de ressource) :
>   `subAccounts.create`, `transfers().transfer` (commun), `pools.*`, `staking.deposit/withdraw`,
>   `account.updateSettings/updateAssetConfig`.
