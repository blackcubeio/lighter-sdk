import { describe, expect, it } from 'vitest';
import type { NativeOrder } from '../../src/common/native';
import { OrderConverter } from '../../src/converters/order';

const BASE: NativeOrder = {
  order_id: '562952417703097',
  market_index: 1,
  initial_base_amount: '0.03092',
  filled_base_amount: '0',
  price: '73964.8',
  is_ask: true,
  type: 'limit',
  time_in_force: 'good-till-time',
  reduce_only: false,
  status: 'open',
  timestamp: 1_780_163_239_969,
};

describe('OrderConverter Lighter', () => {
  const conv = new OrderConverter('BTC', 'perp');

  it('toCommon : is_ask⇒sell, type/tif/status mappés', () => {
    const o = conv.toCommon(BASE);
    expect(o).toMatchObject({
      name: 'BTC',
      kind: 'perp',
      id: '562952417703097',
      side: 'sell',
      type: 'limit',
      price: '73964.8',
      size: '0.03092',
      filled: '0',
      status: 'open',
      tif: 'gtc',
      reduceOnly: false,
    });
  });

  it('statut partiellement exécuté quand 0 < filled < initial', () => {
    expect(conv.toCommon({ ...BASE, filled_base_amount: '0.01' }).status).toBe('partiallyFilled');
  });

  it('mapping des types/statuts/tif natifs Lighter', () => {
    expect(conv.toCommon({ ...BASE, type: 'stop-loss-limit' }).type).toBe('stop');
    expect(conv.toCommon({ ...BASE, type: 'take-profit' }).type).toBe('takeProfit');
    expect(conv.toCommon({ ...BASE, is_ask: false }).side).toBe('buy');
    expect(conv.toCommon({ ...BASE, status: 'canceled-expired' }).status).toBe('expired');
    expect(conv.toCommon({ ...BASE, status: 'canceled-post-only' }).status).toBe('canceled');
    expect(conv.toCommon({ ...BASE, time_in_force: 'immediate-or-cancel' }).tif).toBe('ioc');
  });
});
