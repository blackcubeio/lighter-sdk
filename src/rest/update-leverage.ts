import type { LighterClient } from '../common/config';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

/**
 * Met à jour le levier et/ou le mode de marge d'un marché (`SignUpdateLeverage`).
 * `fraction` = fraction de marge initiale native (`10000 / levier`). `marginMode` cross/isolated.
 */
export async function updateLeverage(
  client: LighterClient,
  label: string | undefined,
  params: { marketIndex: number; fraction: number; marginMode: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signUpdateLeverage({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
