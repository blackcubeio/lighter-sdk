import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';
import type { GroupedOrderLeg } from './wasm-signer';

/**
 * Place un **lot d'ordres groupés** (TX 28, OCO/bracket selon `groupingType`) — signé via le WASM
 * officiel. Les legs sont **natifs** (marketIndex + entiers scalés) ; la façade fait la résolution.
 */
export function createGroupedOrders(
  client: LighterClient,
  label: string | undefined,
  params: { groupingType: number; orders: GroupedOrderLeg[] },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signCreateGroupedOrders({
      groupingType: params.groupingType,
      orders: params.orders,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
