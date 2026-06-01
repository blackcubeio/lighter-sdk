# Documentation — @blackcube/lighter-sdk

- [README principal](../README.md) — démarrage, scopes, modèle, réseaux.
- [Surface commune](common.md) — le **contrat unifié** (identique sur les 4 SDK Blackcube).
- [Surface native](native.md) — les capacités **spécifiques à Lighter** (`dex.native.<cap>()`).
- [signing.md](signing.md) — signature WASM, modèle de clés, bootstrap lazy, régénération.

## Repères

- **Façade** : `new Lighter(signers, { default })` → scopes communs `perp()` / `spot()` /
  `account()` / `transfers()` / `ws()` / `wsSpot()` ; surplus spécifique via le namespace
  `native.<cap>()` (`perp` / `account` / `signing` / `subAccounts` / `pools` / `staking`).
- **Perp et spot** : Lighter expose les deux (`perp()` / `wsSpot()`). **Pas de `system()`**
  (lectures de compte publiques par index).
- **Types unifiés** identiques aux autres SDK Blackcube (`Pair`, `Candle`, `OrderBook`, `Order`,
  `Position`, `Price`, `Trade`, `UserTrade`, `Balance`, `FundingRate`).
- **Signer WASM** officiel vendoré (`wasm/`), bootté en lazy au 1er appel signé.
