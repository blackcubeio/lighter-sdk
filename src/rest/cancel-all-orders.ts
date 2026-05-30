import type { LighterClient } from '../common/config';
import { TIF } from '../common/constants';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

/**
 * Annule **tous** les ordres du compte (`SignCancelAllOrders`). `timeInForce`/`time` pilotent une
 * annulation immédiate (défaut) ou programmée.
 */
export async function cancelAllOrders(
  client: LighterClient,
  label: string | undefined,
  params: { timeInForce?: number; time?: number } = {},
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signCancelAllOrders({
    timeInForce: params.timeInForce ?? TIF.ioc,
    time: params.time ?? 0,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
