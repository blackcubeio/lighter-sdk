import type { NativeLiquidation } from '../common/native';
import type { Liquidation } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = ['id', 'type', 'trade', 'executed_at'] as const;

/**
 * Convertisseur liquidation Lighter (`/liquidations`) → {@link Liquidation} unifié. Le `trade`
 * imbriqué porte prix/taille/frais exécutés. Lighter ne donne pas explicitement le sens du trade de
 * liquidation → `side: null` (détail complet en `xtras`). `name` résolu depuis `market_id` par le
 * résolveur injecté. `executed_at` est déjà en **ms**. Unidirectionnel.
 */
export class LiquidationConverter {
  constructor(private readonly nameOf: (marketId: number) => string) {}

  toCommon(raw: NativeLiquidation): Liquidation {
    const trade = raw.trade;
    return {
      name: this.nameOf(raw.market_id),
      id: raw.id !== undefined ? String(raw.id) : null,
      side: null,
      size: trade?.size ?? null,
      price: trade?.price ?? null,
      fee: trade?.taker_fee ?? null,
      type: raw.type ?? null,
      time: raw.executed_at ?? 0,
      xtras: xtrasOf(raw, KNOWN),
    };
  }
}
