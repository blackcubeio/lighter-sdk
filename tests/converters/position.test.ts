import { describe, expect, it } from 'vitest';
import type { NativePosition } from '../../src/common/native';
import { PositionConverter } from '../../src/converters/position';

const LONG: NativePosition = {
  market_id: 1,
  symbol: 'BTC',
  initial_margin_fraction: '5.00',
  sign: 1,
  position: '0.5',
  avg_entry_price: '74000',
  unrealized_pnl: '-6.2',
  liquidation_price: '16929.46',
  allocated_margin: '0',
};

describe('PositionConverter Lighter', () => {
  const conv = new PositionConverter();

  it('toCommon : sign⇒side, levier = 100/imf (imf en %), marge null si 0', () => {
    const p = conv.toCommon(LONG);
    expect(p).toMatchObject({
      name: 'BTC',
      side: 'long',
      size: '0.5',
      entryPrice: '74000',
      unrealizedPnl: '-6.2',
      leverage: 20, // 100 / 5.00
      liquidationPrice: '16929.46',
      margin: null,
    });
  });

  it('sign négatif ⇒ short', () => {
    expect(conv.toCommon({ ...LONG, sign: -1 }).side).toBe('short');
  });

  it('toCommonMany écarte les positions plates (size 0)', () => {
    const out = conv.toCommonMany([LONG, { ...LONG, symbol: 'ETH', position: '0' }]);
    expect(out.map((p) => p.name)).toEqual(['BTC']);
  });
});
