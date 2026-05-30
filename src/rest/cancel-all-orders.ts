import type { LighterClient } from '../common/config';
import { CANCEL_ALL_MODE } from '../common/constants';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

async function signCancelAll(
  client: LighterClient,
  label: string | undefined,
  mode: number,
  time: number,
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signCancelAllOrders({
    timeInForce: mode, // 1er arg natif = mode CancelAll (immediate/scheduled/abort)
    time,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}

/** Annule **immédiatement** tous les ordres du compte (`SignCancelAllOrders`, mode immédiat). */
export function cancelAllOrders(client: LighterClient, label?: string): Promise<SendTxResult> {
  return signCancelAll(client, label, CANCEL_ALL_MODE.immediate, 0);
}

/**
 * **Arme** le dead-man's switch : programme l'annulation de tous les ordres à l'échéance
 * `deadlineMs` (**timestamp absolu en ms**, cf. SDK officiel `timestamp_ms`). À rafraîchir
 * périodiquement ; le serveur annule tout si l'échéance est atteinte sans nouvel appel.
 */
export function scheduleCancelAll(
  client: LighterClient,
  label: string | undefined,
  deadlineMs: number,
): Promise<SendTxResult> {
  return signCancelAll(client, label, CANCEL_ALL_MODE.scheduled, deadlineMs);
}

/** **Désarme** le dead-man's switch (annule un cancel-all programmé). */
export function disarmCancelAll(client: LighterClient, label?: string): Promise<SendTxResult> {
  return signCancelAll(client, label, CANCEL_ALL_MODE.abort, 0);
}
