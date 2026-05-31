import type { TxResult } from '../common/types';
import type { getFundingRates } from '../rest/get-funding-rates';
import type { getLiquidations } from '../rest/get-liquidations';
import type { getPnl } from '../rest/get-pnl';
import type { getPositionFunding } from '../rest/get-position-funding';
import type { PlaceOrderParams } from './contract';

/**
 * Interfaces **complémentaires** Lighter : surface spécifique, hors contrat commun aux DEX.
 * Accessibles via le namespace uniforme `dex.native.<capacité>(label?)` (convention partagée par les
 * 4 SDK). Noms d'interfaces (`IApiKeys`, `ISubAccountsAdmin`, `ITransfers`, `IPools`…) et verbes
 * (`create`/`update`/`mint`/`burn`/`stake`…) **alignés** sur les autres SDK quand le geste existe
 * ailleurs ; sinon descriptifs (« similaires »). Les types d'entrée portent des **noms de concept
 * propres** (pas de suffixe `Input`/`Params`).
 *
 * Note : le signer WASM officiel sait aussi signer pools / staking / approbation d'intégrateur.
 */

/** Signature : génération de clé API, nonce, token d'auth (signer WASM) — spécifique Lighter. */
export interface ISigning {
  /** Génère une nouvelle paire de clés API (clé privée + publique) via le signer WASM. */
  generate(): Promise<{ privateKey: string; publicKey: string }>;
  /** Prochain nonce de l'API key du signer. */
  getNextNonce(): Promise<number>;
  /** Token d'authentification pour les lectures privées (deadline en secondes, défaut +1 h). */
  getAuthToken(deadlineSeconds?: number): Promise<string>;
}

/** Création de sous-comptes (la **liste** est dans `account().getSubAccounts()`). Verbe aligné `create`. */
export interface ISubAccountsAdmin {
  create(): Promise<TxResult>;
}

/** Un leg d'un lot d'ordres groupés (valeurs **humaines** ; la façade résout marché + scaling). */
export interface GroupedOrder {
  /** Paire (ex. `BTC`). */
  name: string;
  side: 'buy' | 'sell';
  type: PlaceOrderParams['type'];
  /** Taille (chaîne décimale). */
  size: string;
  /** Prix limite / borne de protection (requis). */
  price: string;
  tif?: 'gtc' | 'ioc' | 'alo';
  reduceOnly?: boolean;
  triggerPrice?: string;
  clientId?: string;
}

/**
 * Surplus **perp** Lighter spécifique, accès `dex.native.perp(label?)` (miroir natif de `dex.perp()`) :
 * lectures marché supplémentaires (publiques) **+** ordres groupés (TX 28, OCO/bracket). Hors contrat
 * portable.
 */
export interface INativePerp {
  /** Taux de funding courants par marché / exchange de référence (public). */
  getFundingRates(): ReturnType<typeof getFundingRates>;
  /** Ordres groupés. `groupingType` : 0 = aucun, autres valeurs = OCO/bracket selon le protocole. */
  placeBatch(orders: GroupedOrder[], groupingType?: number): Promise<TxResult>;
}

/** Entrée — lecture du PnL (résolution + bornes). */
export interface PnlParams {
  resolution: string;
  startTime: number;
  endTime: number;
  countBack?: number;
  ignoreTransfers?: boolean;
}
/** Entrée — configuration de compte (mode de trading). */
export interface UpdateSettingsParams {
  accountTradingMode: number;
}
/** Entrée — configuration d'un actif comme marge. */
export interface UpdateAssetConfigParams {
  assetIndex: number;
  assetMarginMode: number;
}

/**
 * Lectures **et** configuration de compte étendues (authentifiées ; `accountIndex`+`auth` injectés
 * par le scope). Absorbe l'ex-`accountConfig` : `updateSettings` (mode de trading), `updateAssetConfig`.
 */
export interface INativeAccount {
  getLiquidations(query?: {
    limit?: number;
    marketId?: number;
  }): ReturnType<typeof getLiquidations>;
  getPositionFunding(query?: {
    limit?: number;
    marketId?: number;
  }): ReturnType<typeof getPositionFunding>;
  getPnl(query: PnlParams): ReturnType<typeof getPnl>;
  updateSettings(params: UpdateSettingsParams): Promise<TxResult>;
  updateAssetConfig(params: UpdateAssetConfigParams): Promise<TxResult>;
}

/** Entrée — création d'une public pool. */
export interface CreatePublicPoolParams {
  operatorFee: number;
  initialTotalShares: number;
  minOperatorShareRate: number;
}
/** Entrée — mise à jour d'une public pool. */
export interface UpdatePublicPoolParams {
  publicPoolIndex: number;
  status: number;
  operatorFee: number;
  minOperatorShareRate: number;
}
/** Entrée — émission/destruction de parts de pool. */
export interface MintSharesParams {
  publicPoolIndex: number;
  shareAmount: number;
}
export interface BurnSharesParams {
  publicPoolIndex: number;
  shareAmount: number;
}

/** Public pools (LP) Lighter. Verbes alignés `create`/`update` (+ `mint`/`burn` métier). */
export interface IPools {
  create(params: CreatePublicPoolParams): Promise<TxResult>;
  update(params: UpdatePublicPoolParams): Promise<TxResult>;
  mint(params: MintSharesParams): Promise<TxResult>;
  burn(params: BurnSharesParams): Promise<TxResult>;
}

/** Entrée — dépôt / retrait de staking (parts de pool de staking). */
export interface StakingDepositParams {
  stakingPoolIndex: number;
  shareAmount: number;
}
export interface StakingWithdrawParams {
  stakingPoolIndex: number;
  shareAmount: number;
}

/** Staking Lighter. Verbes alignés `deposit`/`withdraw` (HL). */
export interface IStaking {
  deposit(params: StakingDepositParams): Promise<TxResult>;
  withdraw(params: StakingWithdrawParams): Promise<TxResult>;
}
