import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeLiquidation } from '../common/native';
import type { QueryParams } from '../common/types';
import { httpGet } from './client';

export interface LiquidationsEnvelope extends LighterEnvelope {
  liquidations?: NativeLiquidation[];
}

/** Liquidations d'un compte (`/liquidations`, requiert `auth`). */
export function getLiquidations(
  client: LighterClient,
  query: { accountIndex: number; auth: string; limit?: number; marketId?: number },
  label?: string,
): Promise<LiquidationsEnvelope> {
  const params: QueryParams = {
    account_index: query.accountIndex,
    limit: query.limit ?? 50,
    auth: query.auth,
  };
  if (query.marketId !== undefined) {
    params.market_id = query.marketId;
  }
  return httpGet<LiquidationsEnvelope>(client, '/api/v1/liquidations', params, label);
}
