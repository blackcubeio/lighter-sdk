import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeTrade } from '../common/native';
import type { Trade } from '../common/types';
import { TradeConverter } from '../converters/trade';
import { httpGet } from './client';

interface TradesEnvelope extends LighterEnvelope {
  trades?: NativeTrade[];
}

export interface GetTradesParams {
  marketId: number;
  /** Nombre de trades. */
  limit?: number;
}

/** Trades publics récents au format unifié (`/recentTrades`). */
export function getTrades(
  client: LighterClient,
  query: GetTradesParams,
  label?: string,
): Promise<Trade[]> {
  return httpGet<TradesEnvelope>(
    client,
    '/api/v1/recentTrades',
    { market_id: query.marketId, limit: query.limit ?? 100 },
    label,
  ).then((env) => {
    const converter = new TradeConverter();
    return (env.trades ?? []).map((t) => converter.toCommon(t));
  });
}
