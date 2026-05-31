import type { NativeCandlestick } from '../common/native';
import type { Candle, MarketKind } from '../common/types';
import { intervalToMs } from '../common/utils';
import { xtrasOf } from './xtras';

const KNOWN = ['t', 'o', 'h', 'l', 'c', 'v', 'V'] as const;

/**
 * Convertisseur bougie Lighter (REST `/candles` et WS `candle`, même shape `{t,o,h,l,c,v,V,i}`) ↔
 * {@link Candle} unifiée. Le wire ne porte ni symbole ni intervalle (passés au constructeur) ;
 * `t` est déjà en **ms** ; le `close time` est calculé via l'intervalle. `v` = base, `V` = quote.
 */
export class CandleConverter {
  private readonly span: number;

  constructor(
    private readonly name: string,
    private readonly interval: string,
    private readonly kind: MarketKind = 'perp',
  ) {
    this.span = intervalToMs(interval);
  }

  toCommon(wire: NativeCandlestick): Candle {
    const t = wire.t;
    return {
      t,
      T: this.span > 0 ? t + this.span : t,
      s: this.name,
      i: this.interval,
      o: String(wire.o),
      c: String(wire.c),
      h: String(wire.h),
      l: String(wire.l),
      v: String(wire.v),
      n: 0,
      kind: this.kind,
      qv: wire.V !== undefined ? String(wire.V) : null,
      tbbv: null,
      tbqv: null,
      xtras: xtrasOf(wire, KNOWN),
    };
  }

  toNative(candle: Candle): NativeCandlestick {
    return {
      t: candle.t,
      o: Number(candle.o),
      h: Number(candle.h),
      l: Number(candle.l),
      c: Number(candle.c),
      v: Number(candle.v),
      V: candle.qv !== null ? Number(candle.qv) : 0,
      ...(candle.xtras as Record<string, unknown> | undefined),
    };
  }
}
