import type { LighterClient } from '../common/config';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

/** Annule un ordre par son index de marché et son `orderIndex` (`SignCancelOrder`). */
export async function cancelOrder(
  client: LighterClient,
  label: string | undefined,
  params: { marketIndex: number; orderIndex: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signCancelOrder({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
