import type { LighterClient } from '../common/config';
import { CHAIN_ID } from '../common/constants';
import type { Network, ResolvedSigner } from '../common/types';
import { getNextNonce } from './get-next-nonce';
import { type WasmInstance, getWasmInstance } from './wasm-signer';

/** Résout un signer par label (obligatoire pour toute écriture signée). */
export function resolveSigner(client: LighterClient, label?: string): ResolvedSigner {
  const key = label ?? Object.keys(client.signers)[0];
  if (key === undefined) {
    throw new Error('Aucun signer disponible; ajoute-en un dans init({ signers })');
  }
  const signer = client.signers[key];
  if (signer === undefined) {
    throw new Error(`Aucun signer enregistré sous "${key}"; ajoute-le dans init({ signers })`);
  }
  return {
    label: key,
    keyType: 'lighter',
    apiPrivateKey: signer.apiPrivateKey,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
    network: signer.network,
    l1Address: signer.l1Address,
    l1PrivateKey: signer.l1PrivateKey,
  };
}

/** Signer résolu + contexte réseau (URL REST + chainId) + nonce + **instance WASM du réseau**. */
export interface PreparedSigner extends ResolvedSigner {
  url: string;
  chainId: number;
  /** Nonce courant récupéré côté SDK (le client HTTP interne du WASM ne fonctionne pas en Node). */
  nonce: number;
  /** Instance WASM **du réseau** de ce signer (isolée par réseau). */
  wasm: WasmInstance;
}

/**
 * Prépare un signer pour une écriture : résout le label, calcule l'URL/chainId du réseau, récupère
 * l'**instance WASM du réseau** (lazy), y **enregistre** (une fois) le client, et **récupère le
 * nonce** via le REST public. On passe ensuite ce nonce explicitement aux fonctions `sign*` : le
 * client HTTP interne du WASM Go ne peut pas résoudre le réseau dans le runtime Node.
 */
export async function prepareSigner(
  client: LighterClient,
  label?: string,
): Promise<PreparedSigner> {
  const signer = resolveSigner(client, label);
  const network: Network = signer.network;
  const url = client.restUrls[network];
  const chainId = CHAIN_ID[network];
  const wasm = await getWasmInstance(url);
  wasm.ensureClient({
    url,
    apiPrivateKey: signer.apiPrivateKey,
    chainId,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  const nonce = await getNextNonce(client, signer.accountIndex, signer.apiKeyIndex, label);
  return { ...signer, url, chainId, nonce, wasm };
}
