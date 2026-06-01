import type { LighterClient } from '../common/config';
import { ROUTE_TYPE, USDC_ASSET_INDEX } from '../common/constants';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/** Retrait de collatéral (`SignWithdraw`). `amount` en micro-USDC ; défaut asset USDC / route perps. */
export function withdraw(
  client: LighterClient,
  label: string | undefined,
  params: { amount: number; assetIndex?: number; routeType?: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signWithdraw({
      assetIndex: params.assetIndex ?? USDC_ASSET_INDEX,
      routeType: params.routeType ?? ROUTE_TYPE.perps,
      amount: params.amount,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
