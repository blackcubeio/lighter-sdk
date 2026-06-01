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

Une API key se crée hors SDK (interface Lighter / SDK officiel). `dex.native.signing().generate()`
génère une paire de clés via le WASM, mais l'**enregistrement** de la clé publique sur le compte
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

## Nonce : écritures concurrentes sérialisées par signer

Lighter expose le **prochain nonce** via `/nextNonce` (lecture) et ne l'incrémente qu'une fois la
transaction **acceptée** par `/sendTx`. Deux écritures concurrentes du **même signer** liraient donc
le même nonce et entreraient en collision (l'une rejetée pour nonce déjà utilisé — perte d'ordre en
argent réel).

Le SDK protège contre ça : la séquence complète **fetch-nonce → sign → send** est **sérialisée par
signer** (clé `network:apiKeyIndex:accountIndex`, cf. `rest/signer-lock.ts`). Conséquences pour
l'appelant :

- Plusieurs écritures lancées en parallèle sur le **même signer** (`place`, `cancel`, `withdraw`,
  `transfer`, `placeBatch`…) sont exécutées **l'une après l'autre**, pas réellement en parallèle.
- **L'ordre de soumission n'est donc PAS garanti** entre des appels concurrents : `Promise.all([a, b])`
  peut envoyer `b` avant `a`. Si l'ordre importe (ex. SL avant TP), **enchaîne les `await`** au lieu
  de les lancer concurremment.
- Des signers **distincts** ne se bloquent pas (chaînes séparées).
- La sérialisation est un état de **process** (comme l'instance WASM) : deux process partageant le
  même signer ne se coordonnent pas — utilise **un signer par process** pour les écritures
  concurrentes inter-process.

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

**Navigateur** : seul le *signer* est Node-only. Les `node:*` sont chargés **paresseusement** au
premier boot du signer (jamais à l'import du module), donc le package reste **bundlable en
navigateur** : les **lectures publiques** et le **WebSocket** (`init({ webSocket })`,
`globalThis.WebSocket` par défaut) fonctionnent côté navigateur. Une tentative de **signature**
(ordres, transferts, retraits…) en navigateur lève une erreur **explicite** (« Signer Lighter
indisponible : il est Node-only … ») au lieu d'un échec de bundling opaque.
