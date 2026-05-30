import type { NativeCandlestick } from '../common/native';
import type { Candle, MarketKind } from '../common/types';
import { intervalToMs } from '../common/utils';
import { xtrasOf } from './xtras';

const KNOWN = ['timestamp', 'open', 'high', 'low', 'close', 'volume0', 'volume1'] as const;

/**
 * Convertisseur bougie Lighter (`/candlesticks`) ↔ {@link Candle} unifiée. Le wire ne porte ni
 * symbole ni intervalle (passés au constructeur) et ne donne que l'`open time` (en **secondes**) ;
 * le `close time` est calculé via l'intervalle. `volume0` = base, `volume1` = quote.
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
    const t = wire.timestamp * 1000;
    return {
      t,
      T: this.span > 0 ? t + this.span : t,
      s: this.name,
      i: this.interval,
      o: String(wire.open),
      c: String(wire.close),
      h: String(wire.high),
      l: String(wire.low),
      v: String(wire.volume0),
      n: 0,
      kind: this.kind,
      qv: String(wire.volume1),
      tbbv: null,
      tbqv: null,
      xtras: xtrasOf(wire, KNOWN),
    };
  }

  toNative(candle: Candle): NativeCandlestick {
    return {
      timestamp: Math.floor(candle.t / 1000),
      open: Number(candle.o),
      high: Number(candle.h),
      low: Number(candle.l),
      close: Number(candle.c),
      volume0: Number(candle.v),
      volume1: candle.qv !== null ? Number(candle.qv) : 0,
      ...(candle.xtras as Record<string, unknown> | undefined),
    };
  }
}
