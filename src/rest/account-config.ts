import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/** Met à jour le mode de trading du compte (`SignUpdateAccountConfig`). */
export function updateAccountConfig(
  client: LighterClient,
  label: string | undefined,
  params: { accountTradingMode: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signUpdateAccountConfig({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}

/** Active/désactive un actif comme marge (`SignUpdateAccountAssetConfig`). */
export function updateAccountAssetConfig(
  client: LighterClient,
  label: string | undefined,
  params: { assetIndex: number; assetMarginMode: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signUpdateAccountAssetConfig({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
