import type { LighterClient } from '../common/config';
import { type SendTxResult, sendTx } from './send-tx';
import { prepareSigner } from './signing';

/** Stake des actifs dans une staking pool (`SignStakeAssets`). */
export async function stakeAssets(
  client: LighterClient,
  label: string | undefined,
  params: { stakingPoolIndex: number; shareAmount: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signStakeAssets({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}

/** Retire des actifs stakés (`SignUnstakeAssets`). */
export async function unstakeAssets(
  client: LighterClient,
  label: string | undefined,
  params: { stakingPoolIndex: number; shareAmount: number },
): Promise<SendTxResult> {
  const signer = await prepareSigner(client, label);
  const tx = signer.wasm.signUnstakeAssets({
    ...params,
    nonce: signer.nonce,
    apiKeyIndex: signer.apiKeyIndex,
    accountIndex: signer.accountIndex,
  });
  return sendTx(client, tx, signer.accountIndex, signer.apiKeyIndex, signer.network);
}
