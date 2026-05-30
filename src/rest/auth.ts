import type { LighterClient } from '../common/config';
import { prepareSigner } from './signing';

/**
 * Produit un **token d'authentification** Lighter pour les lectures privées (ordres actifs,
 * historique, trades du compte). Prépare le signer (instance WASM du réseau + enregistrement du
 * client) puis signe le token. Deadline par défaut : +1 h.
 */
export async function getAuthToken(
  client: LighterClient,
  label?: string,
  deadlineSeconds?: number,
): Promise<{ auth: string; accountIndex: number; apiKeyIndex: number }> {
  const signer = await prepareSigner(client, label);
  const deadline = deadlineSeconds ?? Math.floor(Date.now() / 1000) + 3600;
  const auth = signer.wasm.createAuthToken(deadline, signer.apiKeyIndex, signer.accountIndex);
  return { auth, accountIndex: signer.accountIndex, apiKeyIndex: signer.apiKeyIndex };
}
