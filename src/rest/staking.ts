import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/** Stake des actifs dans une staking pool (`SignStakeAssets`). */
export function stakeAssets(
  client: LighterClient,
  label: string | undefined,
  params: { stakingPoolIndex: number; shareAmount: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signStakeAssets({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}

/** Retire des actifs stakés (`SignUnstakeAssets`). */
export function unstakeAssets(
  client: LighterClient,
  label: string | undefined,
  params: { stakingPoolIndex: number; shareAmount: number },
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signUnstakeAssets({
      ...params,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
