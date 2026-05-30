import { describe, expect, it } from 'vitest';
import type { NativeOrderBookMeta } from '../../src/common/native';
import { PairConverter } from '../../src/converters/pair';

const PERP: NativeOrderBookMeta = {
  symbol: 'BTC',
  market_id: 1,
  market_type: 'perp',
  status: 'active',
  supported_size_decimals: 5,
  supported_price_decimals: 1,
  min_quote_amount: '10.000000',
  min_initial_margin_fraction: 200,
};

const SPOT: NativeOrderBookMeta = {
  symbol: 'LIT/USDC',
  market_id: 2049,
  market_type: 'spot',
  status: 'active',
  supported_size_decimals: 2,
  supported_price_decimals: 4,
  min_quote_amount: '0.001000',
};

describe('PairConverter Lighter', () => {
  const conv = new PairConverter();

  it('perp : quote USDC implicite, levier dérivé (10000/imf), tick/step depuis décimales', () => {
    const p = conv.toCommon(PERP);
    expect(p.name).toBe('BTC');
    expect(p.base).toBe('BTC');
    expect(p.quote).toBe('USDC');
    expect(p.kind).toBe('perp');
    expect(p.szDecimals).toBe(5);
    expect(p.maxLeverage).toBe(50); // 10000 / 200
    expect(p.tickSize).toBe('0.1');
    expect(p.stepSize).toBe('0.00001');
    expect(p.minNotional).toBe('10.000000');
  });

  it('spot : symbole BASE/QUOTE découpé, kind spot', () => {
    const p = conv.toCommon(SPOT);
    expect(p.name).toBe('LIT/USDC');
    expect(p.base).toBe('LIT');
    expect(p.quote).toBe('USDC');
    expect(p.kind).toBe('spot');
    expect(p.maxLeverage).toBeUndefined(); // pas de fraction de marge sur spot
  });

  it('le natif hors cœur part dans xtras (market_id conservé)', () => {
    expect((conv.toCommon(PERP).xtras as Record<string, unknown>).market_id).toBe(1);
  });
});
