import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/** Modifie un ordre existant (`SignModifyOrder`). Valeurs en unités natives (scalées par la façade). */
export function modifyOrder(
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
  return signAndSend(client, label, (signer) =>
    signer.wasm.signModifyOrder({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
