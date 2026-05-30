import type { LighterClient } from '../common/config';
import { ROUTE_TYPE, USDC_ASSET_INDEX } from '../common/constants';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

/** Retrait de collatéral (`SignWithdraw`). `amount` en micro-USDC ; défaut asset USDC / route perps. */
export async function withdraw(
  client: LighterClient,
  label: string | undefined,
  params: { amount: number; assetIndex?: number; routeType?: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signWithdraw({
    assetIndex: params.assetIndex ?? USDC_ASSET_INDEX,
    routeType: params.routeType ?? ROUTE_TYPE.perps,
    amount: params.amount,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
