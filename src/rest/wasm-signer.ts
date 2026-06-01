// Wrapper TypeScript du **signer WASM officiel** Lighter (lib crypto `lighter-go` compilée en
// WebAssembly, vendorée dans `wasm/`). C'est la seule pièce non isolée par instance `Lighter`, mais
// on la rend isolée **par réseau** : une **instance WASM par URL** (donc par réseau), chacune avec
// son propre registre de clients `(apiKeyIndex, accountIndex)` et son propre `chainId`. Ainsi un
// signer mainnet et un signer testnet coexistent réellement isolés.
//
// Technique : le runtime Go publie ses fonctions sur `globalThis` ; on **capture** ces fonctions
// juste après `go.run` (boots **sérialisés** pour ne pas se piétiner), et chaque `Sign*` capturé
// reste une closure liée à SON instance Go (sa mémoire, son registre, son chainId).
//
// **Node-only** (la libcrypto WASM est lue depuis le disque via `node:fs`) : la signature Lighter se
// fait côté serveur. Les APIs Node sont chargées **paresseusement** (`loadNodeApis`) au premier boot
// du signer, **jamais à l'import du module** — ainsi le package reste bundlable en navigateur (les
// lectures publiques et le WebSocket, eux, sont browser-compatibles, cf. `common/config.ts`) ; seule
// une tentative de **signature** en navigateur lève alors une erreur explicite.

/** Réponse standardisée d'une fonction `Sign*` du WASM. */
export interface WasmTx {
  txType: number;
  txInfo: string;
  txHash: string;
  messageToSign?: string;
}

interface WasmError {
  error?: string;
}

type WasmFn = (...args: unknown[]) => Record<string, unknown>;

/** Table de fonctions capturées d'une instance WASM (propriétés nommées, pas d'accès indexé). */
interface WasmFns {
  GenerateAPIKey: WasmFn;
  CreateClient: WasmFn;
  CreateAuthToken: WasmFn;
  SignCreateOrder: WasmFn;
  SignCreateGroupedOrders: WasmFn;
  SignCancelOrder: WasmFn;
  SignCancelAllOrders: WasmFn;
  SignModifyOrder: WasmFn;
  SignUpdateLeverage: WasmFn;
  SignUpdateMargin: WasmFn;
  SignWithdraw: WasmFn;
  SignTransfer: WasmFn;
  SignCreateSubAccount: WasmFn;
  SignCreatePublicPool: WasmFn;
  SignUpdatePublicPool: WasmFn;
  SignMintShares: WasmFn;
  SignBurnShares: WasmFn;
  SignStakeAssets: WasmFn;
  SignUnstakeAssets: WasmFn;
  SignUpdateAccountConfig: WasmFn;
  SignUpdateAccountAssetConfig: WasmFn;
}

const GLOBAL_NAMES: (keyof WasmFns)[] = [
  'GenerateAPIKey',
  'CreateClient',
  'CreateAuthToken',
  'SignCreateOrder',
  'SignCreateGroupedOrders',
  'SignCancelOrder',
  'SignCancelAllOrders',
  'SignModifyOrder',
  'SignUpdateLeverage',
  'SignUpdateMargin',
  'SignWithdraw',
  'SignTransfer',
  'SignCreateSubAccount',
  'SignCreatePublicPool',
  'SignUpdatePublicPool',
  'SignMintShares',
  'SignBurnShares',
  'SignStakeAssets',
  'SignUnstakeAssets',
  'SignUpdateAccountConfig',
  'SignUpdateAccountAssetConfig',
];

interface GoRuntime {
  importObject: unknown;
  run(instance: WebAssembly.Instance): void;
}

/** APIs Node nécessaires à la lecture du `.wasm` (chargées paresseusement, jamais en navigateur). */
interface NodeApis {
  readFileSync: (path: string) => Uint8Array;
  existsSync: (path: string) => boolean;
  join: (...parts: string[]) => string;
  dirname: (path: string) => string;
  fileURLToPath: (url: string) => string;
  createRequire: (path: string) => (id: string) => unknown;
}

let nodeApis: NodeApis | undefined;

/**
 * Charge paresseusement `node:fs`/`node:path`/`node:url`/`node:module`. Le signer Lighter est
 * **Node-only** (libcrypto WASM lue depuis le disque) : en navigateur ces modules sont absents et
 * l'import dynamique échoue → on lève une erreur **explicite** plutôt que de casser le bundling au
 * load. Les lectures publiques et le WebSocket du SDK restent, eux, utilisables côté navigateur.
 */
async function loadNodeApis(): Promise<NodeApis> {
  if (nodeApis !== undefined) {
    return nodeApis;
  }
  try {
    const [fs, path, url, mod] = await Promise.all([
      import('node:fs'),
      import('node:path'),
      import('node:url'),
      import('node:module'),
    ]);
    nodeApis = {
      readFileSync: (p) => fs.readFileSync(p),
      existsSync: (p) => fs.existsSync(p),
      join: (...parts) => path.join(...parts),
      dirname: (p) => path.dirname(p),
      fileURLToPath: (u) => url.fileURLToPath(u),
      createRequire: (p) => mod.createRequire(p),
    };
    return nodeApis;
  } catch (cause) {
    throw new Error(
      'Signer Lighter indisponible : il est **Node-only** (la libcrypto WASM est lue via `node:fs`, ' +
        'absent en navigateur). Les lectures publiques et le WebSocket restent utilisables côté ' +
        'navigateur ; pour signer (ordres, transferts, retraits…), exécutez côté serveur (Node).',
      { cause },
    );
  }
}

/** Chemin du `.wasm` : surchargeable globalement (sinon résolu près du module / cwd). */
let wasmDirOverride: string | undefined;
export function setWasmDir(dir: string): void {
  wasmDirOverride = dir;
}

function resolveWasmDir(api: NodeApis): string {
  if (wasmDirOverride !== undefined) {
    return wasmDirOverride;
  }
  const here = api.dirname(api.fileURLToPath(import.meta.url));
  const candidates = [
    api.join(here, '..', 'wasm'), // dist/index.js → ../wasm
    api.join(here, '..', '..', 'wasm'), // src/rest/wasm-signer.ts → ../../wasm
    api.join(process.cwd(), 'wasm'),
    api.join(process.cwd(), 'node_modules', '@blackcube', 'lighter-sdk', 'wasm'),
  ];
  const found = candidates.find((dir) => api.existsSync(api.join(dir, 'lighter-signer.wasm')));
  if (found === undefined) {
    throw new Error(
      `Signer WASM introuvable. Cherché : ${candidates.join(', ')}. Lance \`pnpm build:wasm\` ou passe le chemin via setWasmDir().`,
    );
  }
  return found;
}

function unwrap<T extends Record<string, unknown>>(result: T & WasmError, what: string): T {
  if (typeof result.error === 'string' && result.error !== '') {
    throw new Error(`${what}: ${result.error}`);
  }
  return result;
}

function toTx(result: Record<string, unknown> & WasmError, what: string): WasmTx {
  unwrap(result, what);
  return {
    txType: Number(result.txType),
    txInfo: String(result.txInfo ?? ''),
    txHash: String(result.txHash ?? ''),
    messageToSign: typeof result.messageToSign === 'string' ? result.messageToSign : undefined,
  };
}

/**
 * Une instance WASM **isolée** (= un réseau). Détient ses fonctions capturées, son registre de
 * clients `(apiKeyIndex, accountIndex)` et — via son runtime Go propre — son `chainId`.
 */
export class WasmInstance {
  private readonly registered = new Set<string>();

  constructor(private readonly fns: WasmFns) {}

  /** Enregistre (une fois) un client de signature pour `(apiKeyIndex, accountIndex)`. */
  ensureClient(params: {
    url: string;
    apiPrivateKey: string;
    chainId: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): void {
    const key = `${params.apiKeyIndex}:${params.accountIndex}`;
    if (this.registered.has(key)) {
      return;
    }
    const res = this.fns.CreateClient(
      params.url,
      params.apiPrivateKey,
      params.chainId,
      params.apiKeyIndex,
      params.accountIndex,
    );
    unwrap(res as Record<string, unknown> & WasmError, 'CreateClient');
    this.registered.add(key);
  }

  generateApiKey(): { privateKey: string; publicKey: string } {
    const res = unwrap(
      this.fns.GenerateAPIKey() as Record<string, unknown> & WasmError,
      'GenerateAPIKey',
    );
    return { privateKey: String(res.privateKey), publicKey: String(res.publicKey) };
  }

  createAuthToken(deadline: number, apiKeyIndex: number, accountIndex: number): string {
    const res = unwrap(
      this.fns.CreateAuthToken(deadline, apiKeyIndex, accountIndex) as Record<string, unknown> &
        WasmError,
      'CreateAuthToken',
    );
    return String(res.authToken);
  }

  signCreateOrder(a: SignCreateOrderArgs): WasmTx {
    return toTx(
      this.fns.SignCreateOrder(
        a.marketIndex,
        a.clientOrderIndex,
        a.baseAmount,
        a.price,
        a.isAsk,
        a.orderType,
        a.timeInForce,
        a.reduceOnly,
        a.triggerPrice,
        a.orderExpiry,
        0, // integratorAccountIndex
        0, // integratorTakerFee
        0, // integratorMakerFee
        0, // skipNonce
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignCreateOrder',
    );
  }

  signCreateGroupedOrders(a: SignCreateGroupedOrdersArgs): WasmTx {
    const orders = a.orders.map((o) => ({
      MarketIndex: o.marketIndex,
      ClientOrderIndex: o.clientOrderIndex,
      BaseAmount: o.baseAmount,
      Price: o.price,
      IsAsk: o.isAsk,
      Type: o.orderType,
      TimeInForce: o.timeInForce,
      ReduceOnly: o.reduceOnly,
      TriggerPrice: o.triggerPrice,
      OrderExpiry: o.orderExpiry,
    }));
    return toTx(
      this.fns.SignCreateGroupedOrders(
        a.groupingType,
        orders,
        0, // integratorAccountIndex
        0, // integratorTakerFee
        0, // integratorMakerFee
        0, // skipNonce
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignCreateGroupedOrders',
    );
  }

  signCancelOrder(a: {
    marketIndex: number;
    orderIndex: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignCancelOrder(
        a.marketIndex,
        a.orderIndex,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignCancelOrder',
    );
  }

  signCancelAllOrders(a: {
    timeInForce: number;
    time: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignCancelAllOrders(
        a.timeInForce,
        a.time,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignCancelAllOrders',
    );
  }

  signModifyOrder(a: {
    marketIndex: number;
    index: number;
    baseAmount: number;
    price: number;
    triggerPrice: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignModifyOrder(
        a.marketIndex,
        a.index,
        a.baseAmount,
        a.price,
        a.triggerPrice,
        0,
        0,
        0,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignModifyOrder',
    );
  }

  signUpdateLeverage(a: {
    marketIndex: number;
    fraction: number;
    marginMode: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignUpdateLeverage(
        a.marketIndex,
        a.fraction,
        a.marginMode,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignUpdateLeverage',
    );
  }

  signUpdateMargin(a: {
    marketIndex: number;
    usdcAmount: number;
    direction: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignUpdateMargin(
        a.marketIndex,
        a.usdcAmount,
        a.direction,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignUpdateMargin',
    );
  }

  signWithdraw(a: {
    assetIndex: number;
    routeType: number;
    amount: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignWithdraw(
        a.assetIndex,
        a.routeType,
        a.amount,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignWithdraw',
    );
  }

  signTransfer(a: {
    toAccountIndex: number;
    assetIndex: number;
    fromRouteType: number;
    toRouteType: number;
    amount: number;
    usdcFee: number;
    memo: string;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignTransfer(
        a.toAccountIndex,
        a.assetIndex,
        a.fromRouteType,
        a.toRouteType,
        a.amount,
        a.usdcFee,
        a.memo,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignTransfer',
    );
  }

  signCreateSubAccount(a: { nonce: number; apiKeyIndex: number; accountIndex: number }): WasmTx {
    return toTx(
      this.fns.SignCreateSubAccount(0, a.nonce, a.apiKeyIndex, a.accountIndex),
      'SignCreateSubAccount',
    );
  }

  signCreatePublicPool(a: {
    operatorFee: number;
    initialTotalShares: number;
    minOperatorShareRate: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignCreatePublicPool(
        a.operatorFee,
        a.initialTotalShares,
        a.minOperatorShareRate,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignCreatePublicPool',
    );
  }

  signUpdatePublicPool(a: {
    publicPoolIndex: number;
    status: number;
    operatorFee: number;
    minOperatorShareRate: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignUpdatePublicPool(
        a.publicPoolIndex,
        a.status,
        a.operatorFee,
        a.minOperatorShareRate,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignUpdatePublicPool',
    );
  }

  signMintShares(a: {
    publicPoolIndex: number;
    shareAmount: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignMintShares(
        a.publicPoolIndex,
        a.shareAmount,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignMintShares',
    );
  }

  signBurnShares(a: {
    publicPoolIndex: number;
    shareAmount: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignBurnShares(
        a.publicPoolIndex,
        a.shareAmount,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignBurnShares',
    );
  }

  signStakeAssets(a: {
    stakingPoolIndex: number;
    shareAmount: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignStakeAssets(
        a.stakingPoolIndex,
        a.shareAmount,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignStakeAssets',
    );
  }

  signUnstakeAssets(a: {
    stakingPoolIndex: number;
    shareAmount: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignUnstakeAssets(
        a.stakingPoolIndex,
        a.shareAmount,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignUnstakeAssets',
    );
  }

  signUpdateAccountConfig(a: {
    accountTradingMode: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignUpdateAccountConfig(
        a.accountTradingMode,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignUpdateAccountConfig',
    );
  }

  signUpdateAccountAssetConfig(a: {
    assetIndex: number;
    assetMarginMode: number;
    nonce: number;
    apiKeyIndex: number;
    accountIndex: number;
  }): WasmTx {
    return toTx(
      this.fns.SignUpdateAccountAssetConfig(
        a.assetIndex,
        a.assetMarginMode,
        0,
        a.nonce,
        a.apiKeyIndex,
        a.accountIndex,
      ),
      'SignUpdateAccountAssetConfig',
    );
  }
}

export interface SignCreateOrderArgs {
  marketIndex: number;
  clientOrderIndex: number;
  baseAmount: number;
  price: number;
  isAsk: number;
  orderType: number;
  timeInForce: number;
  reduceOnly: number;
  triggerPrice: number;
  orderExpiry: number;
  nonce: number;
  apiKeyIndex: number;
  accountIndex: number;
}

/** Un ordre d'un lot groupé (mêmes champs qu'un ordre simple, hors nonce/clés). */
export interface GroupedOrderLeg {
  marketIndex: number;
  clientOrderIndex: number;
  baseAmount: number;
  price: number;
  isAsk: number;
  orderType: number;
  timeInForce: number;
  reduceOnly: number;
  triggerPrice: number;
  /** `-1` = défaut (28 jours). */
  orderExpiry: number;
}

export interface SignCreateGroupedOrdersArgs {
  /** Type de groupement (0 = aucun, OCO/bracket selon le protocole). */
  groupingType: number;
  orders: GroupedOrderLeg[];
  nonce: number;
  apiKeyIndex: number;
  accountIndex: number;
}

const instances = new Map<string, Promise<WasmInstance>>();
// Sérialise les boots : la capture des globals `globalThis.*` ne doit pas être écrasée par un
// boot concurrent (chaque `go.run` réécrit les mêmes noms ; on capture juste après le sien).
let bootChain: Promise<unknown> = Promise.resolve();

/** Instance WASM (lazy) pour une URL/réseau donné. Bootée une seule fois, partagée pour ce réseau. */
export function getWasmInstance(url: string): Promise<WasmInstance> {
  let instance = instances.get(url);
  if (instance === undefined) {
    const next = bootChain.then(() => bootInstance());
    bootChain = next.catch(() => undefined);
    instance = next;
    instances.set(url, instance);
  }
  return instance;
}

async function bootInstance(): Promise<WasmInstance> {
  const api = await loadNodeApis();
  const wasmDir = resolveWasmDir(api);
  const require = api.createRequire(import.meta.url);

  // 1) Charge le runtime Go → globalThis.Go (le module wasm_exec.js est idempotent).
  const wasmExec = require(api.join(wasmDir, 'wasm_exec.js')) as { Go?: new () => GoRuntime };
  if (wasmExec?.Go !== undefined) {
    (globalThis as Record<string, unknown>).Go = wasmExec.Go;
  }
  const Go = (globalThis as Record<string, unknown>).Go as (new () => GoRuntime) | undefined;
  if (Go === undefined) {
    throw new Error('Runtime Go (wasm_exec.js) non chargé');
  }

  // 2) Instancie + exécute (avec le patch d'alias gojs). Une panique du runtime Go pendant
  //    l'instanciation ou `go.run` est **remontée telle quelle** (cause préservée) au lieu d'être
  //    masquée plus loin par le timeout générique d'attente des globals.
  const bytes = api.readFileSync(api.join(wasmDir, 'lighter-signer.wasm'));
  const go = new Go();
  const base = go.importObject as Record<string, Record<string, unknown>>;
  const gojs = base.go ?? base.gojs;
  if (gojs !== undefined) {
    if (gojs['syscall/js.copyBytesToGo'] === undefined) {
      gojs['syscall/js.copyBytesToGo'] = gojs['syscall/js.valueCopyBytesToGo'];
    }
    if (gojs['syscall/js.copyBytesToJS'] === undefined) {
      gojs['syscall/js.copyBytesToJS'] = gojs['syscall/js.valueCopyBytesToJS'];
    }
  }
  const importObject = { ...base, go: gojs, gojs };
  try {
    const { instance } = await WebAssembly.instantiate(
      bytes as unknown as BufferSource,
      importObject as unknown as WebAssembly.Imports,
    );
    go.run(instance);
  } catch (cause) {
    throw new Error(
      `Boot du signer WASM Lighter échoué (instanciation/exécution du runtime Go) : ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause },
    );
  }

  // 3) Attend l'enregistrement des globals, puis **capture** les fonctions de CETTE instance.
  const deadline = Date.now() + 5000;
  const scope = globalThis as unknown as Record<string, WasmFn | undefined>;
  while (typeof scope.GenerateAPIKey !== 'function') {
    if (Date.now() > deadline) {
      throw new Error(
        'Globals du signer WASM non enregistrés après 5 s : le runtime Go a démarré sans publier ' +
          'ses fonctions (`.wasm` incompatible/corrompu, ou `wasm_exec.js` non apparié). Relance ' +
          '`pnpm build:wasm`.',
      );
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  const fns = {} as WasmFns;
  for (const name of GLOBAL_NAMES) {
    const fn = scope[name];
    if (typeof fn !== 'function') {
      throw new Error(`Fonction WASM manquante : ${name}`);
    }
    fns[name] = fn;
  }
  return new WasmInstance(fns);
}
