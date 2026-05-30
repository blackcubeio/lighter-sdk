import type { LighterClient } from '../common/config';
import type { LighterEnvelope } from '../common/native';
import type { SubAccount } from '../common/types';
import { type NativeAccountRef, SubAccountConverter } from '../converters/subaccount';
import { httpGet } from './client';

interface SubAccountsEnvelope extends LighterEnvelope {
  sub_accounts?: NativeAccountRef[];
}

/**
 * Sous-comptes d'une adresse L1 **publics** (`/accountsByL1Address`). `label` optionnel choisit
 * le réseau (défaut mainnet).
 */
export function getSubAccounts(
  client: LighterClient,
  l1Address: string,
  label?: string,
): Promise<SubAccount[]> {
  return httpGet<SubAccountsEnvelope>(
    client,
    '/api/v1/accountsByL1Address',
    { l1_address: l1Address },
    label,
  ).then((env) => {
    const converter = new SubAccountConverter();
    return (env.sub_accounts ?? []).map((s) => converter.toCommon(s));
  });
}
