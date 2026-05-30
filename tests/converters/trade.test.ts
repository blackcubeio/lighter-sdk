import { describe, expect, it } from 'vitest';
import type { NativeTrade } from '../../src/common/native';
import { TradeConverter } from '../../src/converters/trade';

const BASE: NativeTrade = {
  trade_id: 21138100770,
  market_id: 1,
  size: '0.00644',
  price: '73960.8',
  timestamp: 1_780_163_239_969,
};

describe('TradeConverter Lighter', () => {
  const conv = new TradeConverter();

  it('is_maker_ask=true ⇒ taker a acheté (buy)', () => {
    const t = conv.toCommon({ ...BASE, is_maker_ask: true });
    expect(t.side).toBe('buy');
    expect(t.price).toBe('73960.8');
    expect(t.size).toBe('0.00644');
    expect(t.id).toBe(21138100770);
    expect(t.time).toBe(1_780_163_239_969);
  });

  it('is_maker_ask=false ⇒ taker a vendu (sell)', () => {
    expect(conv.toCommon({ ...BASE, is_maker_ask: false }).side).toBe('sell');
  });

  it('is_maker_ask absent ⇒ side null ; natif hors cœur dans xtras', () => {
    const t = conv.toCommon({ ...BASE, tx_hash: 'abc' });
    expect(t.side).toBeNull();
    expect((t.xtras as Record<string, unknown>).tx_hash).toBe('abc');
  });
});
