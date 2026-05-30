import type { LighterClient } from '../common/config';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

/** Modifie un ordre existant (`SignModifyOrder`). Valeurs en unités natives (scalées par la façade). */
export async function modifyOrder(
  client: LighterClient,
  label: string | undefined,
  params: {
    marketIndex: number;
    index: number;
    baseAmount: number;
    price: number;
    triggerPrice: number;
  },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signModifyOrder({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
