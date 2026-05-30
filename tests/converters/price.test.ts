import { describe, expect, it } from 'vitest';
import type { NativeOrderBookMeta } from '../../src/common/native';
import { PriceConverter } from '../../src/converters/price';

const META: NativeOrderBookMeta = {
  symbol: 'BTC',
  market_id: 1,
  market_type: 'perp',
  status: 'active',
  last_trade_price: 73966.9,
  open_interest: 1957.5,
  daily_quote_token_volume: 418_237_764.96,
};

describe('PriceConverter Lighter', () => {
  const conv = new PriceConverter();

  it('toCommon : last / openInterest / volume24h remplis, le reste null', () => {
    const p = conv.toCommon(META);
    expect(p.name).toBe('BTC');
    expect(p.kind).toBe('perp');
    expect(p.last).toBe('73966.9');
    expect(p.openInterest).toBe('1957.5');
    expect(p.volume24h).toBe('418237764.96');
    expect(p.mark).toBeNull();
    expect(p.mid).toBeNull();
    expect(p.funding).toBeNull();
  });

  it('kind dérivé du market_type', () => {
    expect(conv.toCommon({ ...META, symbol: 'LIT/USDC', market_type: 'spot' }).kind).toBe('spot');
  });

  it('champs absents → null', () => {
    const p = conv.toCommon({ symbol: 'X', market_id: 9, market_type: 'perp', status: 'active' });
    expect(p.last).toBeNull();
    expect(p.openInterest).toBeNull();
    expect(p.volume24h).toBeNull();
  });
});
