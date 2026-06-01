import type { LighterClient } from '../common/config';
import type { Network } from '../common/types';
import { resolveSigner } from './signing';

/**
 * Sérialisation de l'allocation du nonce par signer.
 *
 * Lighter expose le **prochain nonce** via `/nextNonce` (lecture). Le serveur ne l'incrémente
 * qu'une fois la transaction **acceptée** (`/sendTx`). Deux écritures concurrentes du même signer
 * liraient donc le **même** nonce et entreraient en collision (une des deux rejetée pour nonce
 * déjà utilisé — perte d'ordre en argent réel).
 *
 * On sérialise la séquence complète **fetch-nonce → sign → send** par signer (clé
 * `network:apiKeyIndex:accountIndex`) via une chaîne de promesses : tant qu'une écriture est en vol,
 * la suivante attend que `/nextNonce` reflète l'incrément. Les signers distincts ne se bloquent pas.
 *
 * État de **process** (comme l'instance WASM) : deux écritures concurrentes dans le même process
 * partagent la chaîne. Un autre process partageant le même signer reste hors de portée (limite
 * documentée — utiliser un signer par process pour les écritures concurrentes inter-process).
 */
const chains = new Map<string, Promise<unknown>>();

/** Clé de file d'attente d'un signer (résolue par label → identité réseau/clé/compte). */
function lockKey(client: LighterClient, label: string | undefined): string {
  const signer = resolveSigner(client, label);
  const network: Network = signer.network;
  return `${network}:${signer.apiKeyIndex}:${signer.accountIndex}`;
}

/**
 * Exécute `fn` (séquence prepare→sign→send d'une écriture signée) en **exclusion mutuelle** par
 * signer. Les appels concurrents sur le même signer sont sérialisés ; sur des signers différents,
 * ils restent parallèles. Une erreur de `fn` ne casse pas la chaîne (les suivants s'exécutent).
 */
export function withSignerLock<T>(
  client: LighterClient,
  label: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const key = lockKey(client, label);
  const previous = chains.get(key) ?? Promise.resolve();
  const result = previous.then(fn, fn);
  // La chaîne ne doit jamais rejeter (sinon elle bloquerait les suivants) : on la neutralise.
  chains.set(
    key,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}
