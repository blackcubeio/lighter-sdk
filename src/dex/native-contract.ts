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

/** Clés API + helpers de signature (génération de clé, nonce, token d'auth) — spécifique Lighter. */
export interface IApiKeys {
  /** Génère une nouvelle paire de clés API (clé privée + publique) via le signer WASM. */
  generate(): Promise<{ privateKey: string; publicKey: string }>;
  /** Prochain nonce de l'API key du signer. */
  nextNonce(): Promise<number>;
  /** Token d'authentification pour les lectures privées (deadline en secondes, défaut +1 h). */
  authToken(deadlineSeconds?: number): Promise<string>;
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

/** Ordres groupés (TX 28, OCO/bracket). Verbe aligné `placeBatch` (HL/Aster/Pacifica). */
export interface IAdvancedOrders {
  /** `groupingType` : 0 = aucun, autres valeurs = OCO/bracket selon le protocole. */
  placeBatch(orders: GroupedOrder[], groupingType?: number): Promise<TxResult>;
}

/** Données de marché supplémentaires (lectures publiques). */
export interface INativeMarket {
  /** Taux de funding courants par marché / exchange de référence. */
  fundingRates(): ReturnType<typeof getFundingRates>;
}

/** Lectures de compte étendues (authentifiées ; `accountIndex`+`auth` injectés par le scope). */
export interface INativeAccount {
  liquidations(query?: { limit?: number; marketId?: number }): ReturnType<typeof getLiquidations>;
  positionFunding(query?: {
    limit?: number;
    marketId?: number;
  }): ReturnType<typeof getPositionFunding>;
  pnl(query: {
    resolution: string;
    startTime: number;
    endTime: number;
    countBack?: number;
    ignoreTransfers?: boolean;
  }): ReturnType<typeof getPnl>;
}

/** Entrée d'un transfert de collatéral entre comptes. */
export interface Transfer {
  /** Index du compte destinataire. */
  toAccountIndex: number;
  /** Montant en USDC (chaîne décimale, ex. `"10.5"`). */
  amount: string;
  /** Mémo (32 bytes / 64 hex). Défaut : zéros. */
  memo?: string;
}

/** Transferts de collatéral entre comptes Lighter. */
export interface ITransfers {
  transfer(input: Transfer): Promise<TxResult>;
}

/** Entrée — création d'une public pool. */
export interface CreatePublicPool {
  operatorFee: number;
  initialTotalShares: number;
  minOperatorShareRate: number;
}
/** Entrée — mise à jour d'une public pool. */
export interface UpdatePublicPool {
  publicPoolIndex: number;
  status: number;
  operatorFee: number;
  minOperatorShareRate: number;
}
/** Entrée — émission/destruction de parts de pool. */
export interface MintShares {
  publicPoolIndex: number;
  shareAmount: number;
}
export interface BurnShares {
  publicPoolIndex: number;
  shareAmount: number;
}

/** Public pools (LP) Lighter. Verbes alignés `create`/`update` (+ `mint`/`burn` métier). */
export interface IPools {
  create(params: CreatePublicPool): Promise<TxResult>;
  update(params: UpdatePublicPool): Promise<TxResult>;
  mint(params: MintShares): Promise<TxResult>;
  burn(params: BurnShares): Promise<TxResult>;
}

/** Entrée — stake / unstake d'actifs. */
export interface Stake {
  stakingPoolIndex: number;
  shareAmount: number;
}
export interface Unstake {
  stakingPoolIndex: number;
  shareAmount: number;
}

/** Staking d'actifs Lighter. */
export interface IStaking {
  stake(params: Stake): Promise<TxResult>;
  unstake(params: Unstake): Promise<TxResult>;
}

/** Entrée — configuration de compte / d'actif. */
export interface UpdateAccountConfig {
  accountTradingMode: number;
}
export interface UpdateAccountAssetConfig {
  assetIndex: number;
  assetMarginMode: number;
}

/** Configuration de compte Lighter : mode de trading, activation d'un actif comme marge. */
export interface IAccountConfig {
  update(params: UpdateAccountConfig): Promise<TxResult>;
  updateAsset(params: UpdateAccountAssetConfig): Promise<TxResult>;
}
