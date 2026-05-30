import { describe, expect, it } from 'vitest';
import type { NativeTrade } from '../../src/common/native';
import { UserTradeConverter } from '../../src/converters/user-trade';

const BASE: NativeTrade = {
  trade_id: 21138316798,
  market_id: 1,
  size: '0.00135',
  price: '73966.9',
  timestamp: 1_780_163_639_208,
  ask_account_id: 708287,
  bid_account_id: 513026,
  ask_id: 562952417714702,
  bid_id: 844422407705492,
  is_maker_ask: false,
};

describe('UserTradeConverter Lighter', () => {
  it('compte côté ask ⇒ sell, orderId = ask_id', () => {
    const t = new UserTradeConverter(708287, 'BTC', 'perp').toCommon(BASE);
    expect(t.side).toBe('sell');
    expect(t.orderId).toBe('562952417714702');
    expect(t.name).toBe('BTC');
    expect(t.kind).toBe('perp');
    expect(t.id).toBe('21138316798');
  });

  it('compte côté bid ⇒ buy, orderId = bid_id', () => {
    const t = new UserTradeConverter(513026, 'BTC').toCommon(BASE);
    expect(t.side).toBe('buy');
    expect(t.orderId).toBe('844422407705492');
  });

  it('maker dérivé de is_maker_ask selon le côté du compte', () => {
    // compte côté bid + is_maker_ask=false ⇒ le bid est le maker
    expect(new UserTradeConverter(513026, 'BTC').toCommon(BASE).maker).toBe(true);
  });
});
