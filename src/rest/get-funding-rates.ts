import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeFundingRate } from '../common/native';
import { httpGet } from './client';

export interface FundingRatesEnvelope extends LighterEnvelope {
  funding_rates?: NativeFundingRate[];
}

/** Taux de funding **courants** par marché et par exchange de référence (`/funding-rates`, public). */
export function getFundingRates(
  client: LighterClient,
  label?: string,
): Promise<FundingRatesEnvelope> {
  return httpGet<FundingRatesEnvelope>(client, '/api/v1/funding-rates', {}, label);
}
