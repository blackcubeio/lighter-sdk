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
