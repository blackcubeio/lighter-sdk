import type { LighterClient } from '../common/config';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

/** Crée une public pool (`SignCreatePublicPool`). */
export async function createPublicPool(
  client: LighterClient,
  label: string | undefined,
  params: { operatorFee: number; initialTotalShares: number; minOperatorShareRate: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signCreatePublicPool({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}

/** Met à jour une public pool (`SignUpdatePublicPool`). */
export async function updatePublicPool(
  client: LighterClient,
  label: string | undefined,
  params: {
    publicPoolIndex: number;
    status: number;
    operatorFee: number;
    minOperatorShareRate: number;
  },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signUpdatePublicPool({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}

/** Émet des parts d'une public pool (`SignMintShares`). */
export async function mintShares(
  client: LighterClient,
  label: string | undefined,
  params: { publicPoolIndex: number; shareAmount: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signMintShares({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}

/** Brûle des parts d'une public pool (`SignBurnShares`). */
export async function burnShares(
  client: LighterClient,
  label: string | undefined,
  params: { publicPoolIndex: number; shareAmount: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signBurnShares({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
