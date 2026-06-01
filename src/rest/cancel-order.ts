import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/** Annule un ordre par son index de marché et son `orderIndex` (`SignCancelOrder`). */
export function cancelOrder(
  client: LighterClient,
  label: string | undefined,
  params: { marketIndex: number; orderIndex: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signCancelOrder({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
