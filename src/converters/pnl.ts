import type { NativePnlEntry } from '../common/native';
import type { PnlPoint } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = ['timestamp', 'trade_pnl'] as const;

/**
 * Convertisseur point de courbe de PnL Lighter (`/pnl`) → {@link PnlPoint} unifié. `trade_pnl` →
 * `pnl` (PnL de trading du point) ; les composantes détaillées (pool, staking, inflow/outflow,
 * volume) restent dans `xtras`. `timestamp` déjà en **ms**. Unidirectionnel.
 */
export class PnlConverter {
  toCommon(raw: NativePnlEntry): PnlPoint {
    return {
      time: raw.timestamp,
      pnl: raw.trade_pnl !== undefined ? String(raw.trade_pnl) : null,
      xtras: xtrasOf(raw, KNOWN),
    };
  }
}
