import type { NativePosition } from '../common/native';
import type { Position } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = [
  'symbol',
  'sign',
  'position',
  'avg_entry_price',
  'unrealized_pnl',
  'initial_margin_fraction',
  'liquidation_price',
  'allocated_margin',
] as const;

/**
 * Convertisseur position Lighter (champ `positions` de `/account`) → {@link Position} unifiée.
 * `sign` (-1/+1) porte le sens, `position` la taille (magnitude). Le levier se déduit de
 * `initial_margin_fraction` (en **pourcentage**, ex. `"5.00"` ⇒ 20×). Unidirectionnel.
 */
export class PositionConverter {
  toCommon(raw: NativePosition): Position {
    const size = raw.position;
    const flat = Number(size) === 0;
    const side = flat ? null : (raw.sign ?? 0) < 0 ? 'short' : 'long';
    const imf = raw.initial_margin_fraction !== undefined ? Number(raw.initial_margin_fraction) : 0;
    const leverage = imf > 0 ? Math.round(100 / imf) : null;
    const margin =
      raw.allocated_margin !== undefined && Number(raw.allocated_margin) !== 0
        ? raw.allocated_margin
        : null;
    return {
      name: raw.symbol,
      side,
      size,
      entryPrice: raw.avg_entry_price ?? null,
      markPrice: null,
      unrealizedPnl: raw.unrealized_pnl ?? null,
      leverage,
      liquidationPrice: raw.liquidation_price ?? null,
      margin,
      xtras: xtrasOf(raw, KNOWN),
    };
  }

  /** Convertit une liste, en écartant les positions plates. */
  toCommonMany(raw: NativePosition[]): Position[] {
    return raw.map((p) => this.toCommon(p)).filter((p) => Number(p.size) !== 0);
  }
}
