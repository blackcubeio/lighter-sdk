import type { LighterClient } from '../common/config';
import { ROUTE_TYPE, USDC_ASSET_INDEX } from '../common/constants';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

const ZERO_MEMO = '0'.repeat(64);

/**
 * Transfert de collatéral vers un autre compte (`SignTransfer`). `amount` en micro-USDC.
 * `memo` : 32 bytes / 64 hex (défaut : zéros). Défaut asset USDC, routes perps.
 */
export async function transfer(
  client: LighterClient,
  label: string | undefined,
  params: {
    toAccountIndex: number;
    amount: number;
    assetIndex?: number;
    fromRouteType?: number;
    toRouteType?: number;
    usdcFee?: number;
    memo?: string;
  },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signTransfer({
    toAccountIndex: params.toAccountIndex,
    assetIndex: params.assetIndex ?? USDC_ASSET_INDEX,
    fromRouteType: params.fromRouteType ?? ROUTE_TYPE.perps,
    toRouteType: params.toRouteType ?? ROUTE_TYPE.perps,
    amount: params.amount,
    usdcFee: params.usdcFee ?? 0,
    memo: params.memo ?? ZERO_MEMO,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
