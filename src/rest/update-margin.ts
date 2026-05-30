import type { LighterClient } from '../common/config';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

/**
 * Ajuste la marge isolée d'un marché (`SignUpdateMargin`). `usdcAmount` en micro-USDC,
 * `direction` = ajout (1) ou retrait (0) — cf. `MARGIN_DIRECTION`.
 */
export async function updateMargin(
  client: LighterClient,
  label: string | undefined,
  params: { marketIndex: number; usdcAmount: number; direction: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signUpdateMargin({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
