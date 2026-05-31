import type { NativeFundingRate } from '../common/native';
import type { FundingRate } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = ['symbol', 'rate'] as const;

/**
 * Convertisseur taux de funding **courant** Lighter (`/funding-rates`) → {@link FundingRate}
 * (type commun). Le wire donne un `rate` décimal par marché et par `exchange` de référence, sans
 * timestamp : on date au moment de la lecture (`now`). `name = symbol` ; `exchange`/`market_id`
 * partent dans `xtras`. Unidirectionnel.
 */
export class FundingRateConverter {
  constructor(private readonly now: number = Date.now()) {}

  toCommon(raw: NativeFundingRate): FundingRate {
    return {
      name: raw.symbol,
      fundingRate: String(raw.rate),
      time: this.now,
      xtras: xtrasOf(raw, KNOWN),
    };
  }
}
