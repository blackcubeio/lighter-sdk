import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeFunding } from '../common/native';
import type { FundingRate } from '../common/types';
import { FundingConverter } from '../converters/funding';
import { httpGet } from './client';

interface FundingsEnvelope extends LighterEnvelope {
  fundings?: NativeFunding[];
}

export interface GetFundingHistoryQuery {
  marketId: number;
  name: string;
  /** Résolution (`1h`, `8h`…) ; défaut `1h`. */
  interval?: string;
  /** Début (ms). */
  startTime?: number;
  /** Fin (ms). */
  endTime?: number;
  /** Nombre de points. */
  limit?: number;
}

const toSeconds = (ms?: number): number | undefined =>
  ms === undefined ? undefined : Math.floor(ms / 1000);

/** Historique des taux de funding au format unifié (`/fundings`). */
export function getFundingHistory(
  client: LighterClient,
  query: GetFundingHistoryQuery,
  label?: string,
): Promise<FundingRate[]> {
  return httpGet<FundingsEnvelope>(
    client,
    '/api/v1/fundings',
    {
      market_id: query.marketId,
      resolution: query.interval ?? '1h',
      start_timestamp: toSeconds(query.startTime),
      end_timestamp: toSeconds(query.endTime),
      count_back: query.limit,
    },
    label,
  ).then((env) => {
    const converter = new FundingConverter(query.name);
    return (env.fundings ?? []).map((f) => converter.toCommon(f));
  });
}
