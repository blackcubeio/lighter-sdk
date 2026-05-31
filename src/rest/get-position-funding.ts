import type { LighterClient } from '../common/config';
import type { LighterEnvelope } from '../common/native';
import type { QueryParams } from '../common/types';
import { httpGet } from './client';

export interface PositionFundingEnvelope extends LighterEnvelope {
  position_fundings?: unknown[];
}

/** Paiements de funding par position d'un compte (`/positionFunding`, requiert `auth`). */
export function getPositionFunding(
  client: LighterClient,
  query: { accountIndex: number; auth: string; limit?: number; marketId?: number },
  label?: string,
): Promise<PositionFundingEnvelope> {
  const params: QueryParams = {
    account_index: query.accountIndex,
    limit: query.limit ?? 50,
    auth: query.auth,
  };
  if (query.marketId !== undefined) {
    params.market_id = query.marketId;
  }
  return httpGet<PositionFundingEnvelope>(client, '/api/v1/positionFunding', params, label);
}
