import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativePnlEntry } from '../common/native';
import type { QueryParams } from '../common/types';
import { httpGet } from './client';

export interface PnlEnvelope extends LighterEnvelope {
  pnl?: NativePnlEntry[];
}

/** Courbe de PnL d'un compte (`/pnl`, requiert `auth` pour un compte principal). */
export function getPnl(
  client: LighterClient,
  query: {
    accountIndex: number;
    auth: string;
    resolution: string;
    startTime: number;
    endTime: number;
    countBack?: number;
    ignoreTransfers?: boolean;
  },
  label?: string,
): Promise<PnlEnvelope> {
  const params: QueryParams = {
    by: 'index',
    value: query.accountIndex,
    resolution: query.resolution,
    start_timestamp: query.startTime,
    end_timestamp: query.endTime,
    count_back: query.countBack ?? 0,
    auth: query.auth,
  };
  if (query.ignoreTransfers !== undefined) {
    params.ignore_transfers = query.ignoreTransfers;
  }
  return httpGet<PnlEnvelope>(client, '/api/v1/pnl', params, label);
}
