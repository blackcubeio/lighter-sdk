# Documentation — @blackcube/lighter-sdk

- [README principal](../README.md) — démarrage, scopes, modèle, réseaux.
- [signing.md](signing.md) — signature WASM, modèle de clés, bootstrap lazy, régénération.

## Repères

- **Façade** : `new Lighter(signers, { default })` → `perp()` / `account()` / `ws()` +
  `apiKeys()` / `subAccounts()` / `transfers()`.
- **Perp-only** : pas de `spot()`. **Pas de `system()`** (lectures de compte publiques par index).
- **Types unifiés** identiques aux autres SDK Blackcube (`Pair`, `Candle`, `OrderBook`, `Order`,
  `Position`, `Price`, `Trade`, `UserTrade`, `Balance`, `FundingRate`).
- **Signer WASM** officiel vendoré (`wasm/`), bootté en lazy au 1er appel signé.
