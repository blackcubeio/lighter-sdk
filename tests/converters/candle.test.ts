import { describe, expect, it } from 'vitest';
import type { NativeCandlestick } from '../../src/common/native';
import { CandleConverter } from '../../src/converters/candle';

const WIRE: NativeCandlestick = {
  t: 1_780_192_800_000, // open time en ms
  o: 74002,
  h: 74201,
  l: 73840.3,
  c: 74049.1,
  v: 192.0664, // volume base
  V: 14_212_370.82, // volume quote
  i: 21_156_302_243, // dernier trade id
};

describe('CandleConverter Lighter', () => {
  const conv = new CandleConverter('BTC', '1h', 'perp');

  it('toCommon : t déjà en ms, close time via intervalle, v=base / qv=quote', () => {
    const c = conv.toCommon(WIRE);
    expect(c.t).toBe(1_780_192_800_000);
    expect(c.T).toBe(1_780_192_800_000 + 3_600_000);
    expect(c.s).toBe('BTC');
    expect(c.i).toBe('1h');
    expect({ o: c.o, h: c.h, l: c.l, c: c.c, v: c.v, qv: c.qv }).toEqual({
      o: '74002',
      h: '74201',
      l: '73840.3',
      c: '74049.1',
      v: '192.0664',
      qv: '14212370.82',
    });
    expect(c.kind).toBe('perp');
    expect(c.xtras).toEqual({ i: 21_156_302_243 }); // trade id hors cœur
  });

  it('toNative(toCommon(wire)) ≡ wire (bijection, trade id conservé via xtras)', () => {
    expect(conv.toNative(conv.toCommon(WIRE))).toEqual(WIRE);
  });

  it('kind par défaut = perp ; kind spot propagé', () => {
    expect(new CandleConverter('ETH', '1m').toCommon(WIRE).kind).toBe('perp');
    expect(new CandleConverter('LIT/USDC', '1m', 'spot').toCommon(WIRE).kind).toBe('spot');
  });
});
