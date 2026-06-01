import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/** Crée un sous-compte pour le compte du signer (`SignCreateSubAccount`). */
export function createSubAccount(client: LighterClient, label?: string): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signCreateSubAccount({
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
