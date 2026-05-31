import type { NativePositionFunding } from '../common/native';
import type { PositionFundingEntry } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = [
  'timestamp',
  'market_id',
  'rate',
  'position_size',
  'position_side',
  'change',
] as const;

/**
 * Convertisseur paiement de funding par position Lighter (`/positionFunding`) →
 * {@link PositionFundingEntry} unifié. `change` (variation de solde appliquée) → `pnl`. `name`
 * résolu depuis `market_id` par le résolveur injecté. `timestamp` déjà en **ms**. Unidirectionnel.
 */
export class PositionFundingConverter {
  constructor(private readonly nameOf: (marketId: number) => string) {}

  toCommon(raw: NativePositionFunding): PositionFundingEntry {
    return {
      name: this.nameOf(raw.market_id),
      side: raw.position_side ?? null,
      size: raw.position_size ?? null,
      fundingRate: raw.rate ?? null,
      pnl: raw.change ?? null,
      time: raw.timestamp,
      xtras: xtrasOf(raw, KNOWN),
    };
  }
}
