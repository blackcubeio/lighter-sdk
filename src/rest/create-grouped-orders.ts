import type { LighterClient } from '../common/config';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';
import type { GroupedOrderLeg } from './wasm-signer';

/**
 * Place un **lot d'ordres groupés** (TX 28, OCO/bracket selon `groupingType`) — signé via le WASM
 * officiel. Les legs sont **natifs** (marketIndex + entiers scalés) ; la façade fait la résolution.
 */
export async function createGroupedOrders(
  client: LighterClient,
  label: string | undefined,
  params: { groupingType: number; orders: GroupedOrderLeg[] },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signCreateGroupedOrders({
    groupingType: params.groupingType,
    orders: params.orders,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
