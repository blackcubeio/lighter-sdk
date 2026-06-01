import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/** Crée une public pool (`SignCreatePublicPool`). */
export function createPublicPool(
  client: LighterClient,
  label: string | undefined,
  params: { operatorFee: number; initialTotalShares: number; minOperatorShareRate: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signCreatePublicPool({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}

/** Met à jour une public pool (`SignUpdatePublicPool`). */
export function updatePublicPool(
  client: LighterClient,
  label: string | undefined,
  params: {
    publicPoolIndex: number;
    status: number;
    operatorFee: number;
    minOperatorShareRate: number;
  },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signUpdatePublicPool({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}

/** Émet des parts d'une public pool (`SignMintShares`). */
export function mintShares(
  client: LighterClient,
  label: string | undefined,
  params: { publicPoolIndex: number; shareAmount: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signMintShares({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}

/** Brûle des parts d'une public pool (`SignBurnShares`). */
export function burnShares(
  client: LighterClient,
  label: string | undefined,
  params: { publicPoolIndex: number; shareAmount: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signBurnShares({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
