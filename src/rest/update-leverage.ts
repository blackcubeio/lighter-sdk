import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/**
 * Met à jour le levier et/ou le mode de marge d'un marché (`SignUpdateLeverage`).
 * `fraction` = fraction de marge initiale native (`10000 / levier`). `marginMode` cross/isolated.
 */
export function updateLeverage(
  client: LighterClient,
  label: string | undefined,
  params: { marketIndex: number; fraction: number; marginMode: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signUpdateLeverage({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
