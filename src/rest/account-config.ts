import type { LighterClient } from '../common/config';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

/** Met à jour le mode de trading du compte (`SignUpdateAccountConfig`). */
export async function updateAccountConfig(
  client: LighterClient,
  label: string | undefined,
  params: { accountTradingMode: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signUpdateAccountConfig({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}

/** Active/désactive un actif comme marge (`SignUpdateAccountAssetConfig`). */
export async function updateAccountAssetConfig(
  client: LighterClient,
  label: string | undefined,
  params: { assetIndex: number; assetMarginMode: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signUpdateAccountAssetConfig({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
