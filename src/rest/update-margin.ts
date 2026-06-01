import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/**
 * Ajuste la marge isolée d'un marché (`SignUpdateMargin`). `usdcAmount` en micro-USDC,
 * `direction` = ajout (1) ou retrait (0) — cf. `MARGIN_DIRECTION`.
 */
export function updateMargin(
  client: LighterClient,
  label: string | undefined,
  params: { marketIndex: number; usdcAmount: number; direction: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signUpdateMargin({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
