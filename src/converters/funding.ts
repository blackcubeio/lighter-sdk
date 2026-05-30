import type { NativeFunding } from '../common/native';
import type { FundingRate } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = ['timestamp', 'rate'] as const;

/**
 * Convertisseur funding Lighter (`/fundings`) → {@link FundingRate}. Le wire donne un `rate` non
 * signé + une `direction` (`long`/`short`) : on **signe** le taux (long ⇒ positif, les longs
 * paient ; short ⇒ négatif). `timestamp` est en **secondes** → converti en ms. Le `name` est
 * porté par le constructeur (absent du wire).
 */
export class FundingConverter {
  constructor(private readonly name: string) {}

  toCommon(raw: NativeFunding): FundingRate {
    const signed = raw.direction === 'short' ? `-${raw.rate}` : raw.rate;
    return {
      name: this.name,
      fundingRate: signed,
      time: raw.timestamp * 1000,
      xtras: xtrasOf(raw, KNOWN),
    };
  }
}
