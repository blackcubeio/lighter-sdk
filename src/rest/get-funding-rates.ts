import type { LighterClient } from '../common/config';
import type { LighterEnvelope } from '../common/native';
import { httpGet } from './client';

export interface FundingRatesEnvelope extends LighterEnvelope {
  funding_rates?: Array<{ market_id: number; exchange: string; symbol: string; rate: number }>;
}

/** Taux de funding **courants** par marché et par exchange de référence (`/funding-rates`, public). */
export function getFundingRates(
  client: LighterClient,
  label?: string,
): Promise<FundingRatesEnvelope> {
  return httpGet<FundingRatesEnvelope>(client, '/api/v1/funding-rates', {}, label);
}
