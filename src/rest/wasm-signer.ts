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
// Node-only (lecture du `.wasm` via `node:fs`) : la signature Lighter se fait côté serveur.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Chemin du `.wasm` : surchargeable globalement (sinon résolu près du module / cwd). */
let wasmDirOverride: string | undefined;
export function setWasmDir(dir: string): void {
  wasmDirOverride = dir;
}

function resolveWasmDir(): string {
  if (wasmDirOverride !== undefined) {
    return wasmDirOverride;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', 'wasm'), // dist/index.js → ../wasm
    join(here, '..', '..', 'wasm'), // src/rest/wasm-signer.ts → ../../wasm
    join(process.cwd(), 'wasm'),
    join(process.cwd(), 'node_modules', '@blackcube', 'lighter-sdk', 'wasm'),
  ];
  const found = candidates.find((dir) => existsSync(join(dir, 'lighter-signer.wasm')));
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
  const wasmDir = resolveWasmDir();
  const require = createRequire(import.meta.url);

  // 1) Charge le runtime Go → globalThis.Go (le module wasm_exec.js est idempotent).
  const wasmExec = require(join(wasmDir, 'wasm_exec.js'));
  if (wasmExec?.Go !== undefined) {
    (globalThis as Record<string, unknown>).Go = wasmExec.Go;
  }
  const Go = (globalThis as Record<string, unknown>).Go as (new () => GoRuntime) | undefined;
  if (Go === undefined) {
    throw new Error('Runtime Go (wasm_exec.js) non chargé');
  }

  // 2) Instancie + exécute (avec le patch d'alias gojs).
  const bytes = readFileSync(join(wasmDir, 'lighter-signer.wasm'));
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
  const { instance } = await WebAssembly.instantiate(
    bytes as unknown as BufferSource,
    importObject as unknown as WebAssembly.Imports,
  );
  go.run(instance);

  // 3) Attend l'enregistrement des globals, puis **capture** les fonctions de CETTE instance.
  const deadline = Date.now() + 5000;
  const scope = globalThis as unknown as Record<string, WasmFn | undefined>;
  while (typeof scope.GenerateAPIKey !== 'function') {
    if (Date.now() > deadline) {
      throw new Error('Globals du signer WASM non enregistrés après 5 s');
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
