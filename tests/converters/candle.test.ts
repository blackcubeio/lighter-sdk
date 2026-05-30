import { describe, expect, it } from 'vitest';
import type { NativeCandlestick } from '../../src/common/native';
import { CandleConverter } from '../../src/converters/candle';

const WIRE: NativeCandlestick = {
  timestamp: 1_700_000_000, // secondes
  open: 74000,
  high: 74500,
  low: 73800,
  close: 74250,
  volume0: 12.5,
  volume1: 925_000,
  last_trade_id: 42,
};

describe('CandleConverter Lighter', () => {
  const conv = new CandleConverter('BTC', '1h', 'perp');

  it('toCommon : timestamp s → ms, close time via intervalle, v=base / qv=quote', () => {
    const c = conv.toCommon(WIRE);
    expect(c.t).toBe(1_700_000_000_000);
    expect(c.T).toBe(1_700_000_000_000 + 3_600_000);
    expect(c.s).toBe('BTC');
    expect(c.i).toBe('1h');
    expect({ o: c.o, h: c.h, l: c.l, c: c.c, v: c.v, qv: c.qv }).toEqual({
      o: '74000',
      h: '74500',
      l: '73800',
      c: '74250',
      v: '12.5',
      qv: '925000',
    });
    expect(c.kind).toBe('perp');
    expect(c.xtras).toEqual({ last_trade_id: 42 });
  });

  it('toNative(toCommon(wire)) ≡ wire (bijection, last_trade_id conservé via xtras)', () => {
    expect(conv.toNative(conv.toCommon(WIRE))).toEqual(WIRE);
  });

  it('kind par défaut = perp ; kind spot propagé', () => {
    expect(new CandleConverter('ETH', '1m').toCommon(WIRE).kind).toBe('perp');
    expect(new CandleConverter('LIT/USDC', '1m', 'spot').toCommon(WIRE).kind).toBe('spot');
  });
});
