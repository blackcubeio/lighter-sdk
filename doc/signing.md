# Signature Lighter (signer WASM)

Lighter signe ses transactions L2 avec une **clé API** sur une courbe maison. Il n'existe **pas**
d'implémentation en JS pur : la signature passe par la lib crypto officielle `lighter-go` compilée
en **WebAssembly**. Le SDK **vendore** ce binaire (`wasm/lighter-signer.wasm` + `wasm/wasm_exec.js`).

## Modèle de clés (`Signer`)

```ts
interface Signer {
  apiPrivateKey: string; // clé privée de l'API key Lighter (hex), utilisée par le WASM
  apiKeyIndex: number;   // index de l'API key (uint8) : 0–1 réservés (web/mobile), 2–254 custom
  accountIndex: number;  // index du compte L2 (identifie le compte côté backend)
  network: 'mainnet' | 'testnet';
  l1Address?: string;    // adresse L1 (EVM) — requise pour getSubAccounts (lecture par adresse)
  l1PrivateKey?: string; // clé L1 (EVM) — seulement pour changePubKey / transfer (signature L1)
}
```

Une API key se crée hors SDK (interface Lighter / SDK officiel). `apiKeys().generateApiKey()` génère
une paire de clés via le WASM, mais l'**enregistrement** de la clé publique sur le compte
(`changePubKey`) n'est pas surfacé par cette version.

## Une instance WASM **par réseau** (isolation préservée)

Le runtime Go publie ses fonctions sur `globalThis`, donc deux `go.run` partagent les mêmes noms ;
mais chaque `Sign*`/`CreateClient` est une **closure liée à son instance Go** (mémoire, registre,
`chainId` de package propres). On exploite ça : une **instance WASM par URL/réseau**, dont on
**capture** les fonctions juste après `go.run` (boots **sérialisés** pour ne pas s'écraser). Résultat :

- Un signer **mainnet** et un signer **testnet** utilisent deux instances **réellement isolées**
  (registres + `chainId` séparés) → ils coexistent dans le même process, comme le reste du SDK.
- Chaque instance est **bootée en lazy**, au **premier appel signé** sur son réseau (~14 Mo par
  réseau réellement touché). Les lectures publiques n'en ont **aucun** besoin.
- Dans une instance, chaque couple `(apiKeyIndex, accountIndex)` n'est enregistré qu'**une fois**.
- Le nonce **n'est pas** résolu par le WASM (son client HTTP Go ne fonctionne pas dans le runtime
  Node) : le SDK le récupère via le REST public (`/nextNonce`) et le passe explicitement.

## Flux d'une écriture

1. `prepareSigner` : résout le label → réseau (URL REST + `chainId`), enregistre le client WASM.
2. `Sign*` (WASM) : produit `{ txType, txInfo, txHash }` (signature locale).
3. `POST /api/v1/sendTx` (form-urlencoded : `tx_type`, `tx_info`, `account_index`, `api_key_index`).

Les **lectures privées** (ordres actifs, historique, fills) exigent un **token d'auth** signé
(`CreateAuthToken`), passé en query `auth`. `account` / `positions` / `balances` / `accountsByL1Address`
sont eux **publics par index**.

## Régénérer le binaire

```sh
pnpm build:wasm
```

Le script `scripts/build-wasm.mjs` clone `github.com/elliottech/lighter-go`, compile
`GOOS=js GOARCH=wasm go build ./wasm/`, et copie `wasm_exec.js` depuis le GOROOT installé
(nécessite la toolchain Go). On ne fait confiance à **aucun** binaire `.wasm` tiers.

## Environnement

Le signer lit le `.wasm` via `node:fs` : il est **Node-only** (la signature se fait côté serveur).
Le chemin est résolu près du module (`dist/` ou `src/`) ou via `cwd`/`node_modules`.
