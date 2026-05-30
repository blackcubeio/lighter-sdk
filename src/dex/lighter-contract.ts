import type { TxResult } from '../common/types';

/**
 * Interfaces **complémentaires** Lighter : surface spécifique à Lighter, hors contrat commun aux
 * DEX. Exposées par des scopes dédiés de la façade (`apiKeys()`, `subAccounts()`, `transfers()`).
 *
 * Note : le signer WASM officiel sait aussi signer pools publics / staking / approbation
 * d'intégrateur ; ces capacités existent mais ne sont pas (encore) surfacées par la façade.
 */

/** Gestion des clés API Lighter + utilitaires de signature (nonce, token d'auth). */
export interface ILighterApiKeys {
  /** Génère une nouvelle paire de clés API (clé privée + publique) via le signer WASM. */
  generateApiKey(): Promise<{ privateKey: string; publicKey: string }>;
  /** Prochain nonce de l'API key du signer. */
  getNextNonce(): Promise<number>;
  /** Token d'authentification pour les lectures privées (deadline en secondes, défaut +1 h). */
  getAuthToken(deadlineSeconds?: number): Promise<string>;
}

/** Création de sous-comptes (la **liste** est dans `account().getSubAccounts()`). */
export interface ILighterSubAccounts {
  createSubAccount(): Promise<TxResult>;
}

/** Entrée d'un transfert de collatéral entre comptes. */
export interface LighterTransferInput {
  /** Index du compte destinataire. */
  toAccountIndex: number;
  /** Montant en USDC (chaîne décimale, ex. `"10.5"`). */
  amount: string;
  /** Mémo (32 bytes / 64 hex). Défaut : zéros. */
  memo?: string;
}

/** Transferts de collatéral entre comptes Lighter. */
export interface ILighterTransfers {
  transfer(input: LighterTransferInput): Promise<TxResult>;
}

/** Public pools (LP) Lighter : création, mise à jour, émission/destruction de parts. */
export interface ILighterPools {
  createPublicPool(params: {
    operatorFee: number;
    initialTotalShares: number;
    minOperatorShareRate: number;
  }): Promise<TxResult>;
  updatePublicPool(params: {
    publicPoolIndex: number;
    status: number;
    operatorFee: number;
    minOperatorShareRate: number;
  }): Promise<TxResult>;
  mintShares(params: { publicPoolIndex: number; shareAmount: number }): Promise<TxResult>;
  burnShares(params: { publicPoolIndex: number; shareAmount: number }): Promise<TxResult>;
}

/** Staking d'actifs Lighter. */
export interface ILighterStaking {
  stakeAssets(params: { stakingPoolIndex: number; shareAmount: number }): Promise<TxResult>;
  unstakeAssets(params: { stakingPoolIndex: number; shareAmount: number }): Promise<TxResult>;
}

/** Configuration de compte Lighter : mode de trading, activation d'un actif comme marge. */
export interface ILighterAccountConfig {
  updateAccountConfig(params: { accountTradingMode: number }): Promise<TxResult>;
  updateAccountAssetConfig(params: {
    assetIndex: number;
    assetMarginMode: number;
  }): Promise<TxResult>;
}
