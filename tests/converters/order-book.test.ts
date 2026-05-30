import { describe, expect, it } from 'vitest';
import { OrderBookConverter } from '../../src/converters/order-book';

const RAW = {
  asks: [
    { price: '74001.0', remaining_base_amount: '0.5' },
    { price: '74002.0', remaining_base_amount: '0.3' },
    { price: '74001.0', remaining_base_amount: '0.2' }, // même prix → agrégé
  ],
  bids: [
    { price: '73999.0', remaining_base_amount: '1.0' },
    { price: '74000.0', remaining_base_amount: '2.0' },
  ],
};

describe('OrderBookConverter Lighter', () => {
  const conv = new OrderBookConverter('BTC', 'perp');

  it('agrège par prix (taille cumulée + nb d’ordres) et trie bids ↓ / asks ↑', () => {
    const ob = conv.toCommon(RAW);
    expect(ob.name).toBe('BTC');
    expect(ob.kind).toBe('perp');
    expect(ob.asks).toEqual([
      { price: '74001.0', size: '0.7', n: 2 }, // 0.5 + 0.2, 2 ordres
      { price: '74002.0', size: '0.3', n: 1 },
    ]);
    expect(ob.bids).toEqual([
      { price: '74000.0', size: '2', n: 1 },
      { price: '73999.0', size: '1', n: 1 },
    ]);
    expect(ob.time).toBeNull();
  });

  it('asks tous strictement au-dessus des bids', () => {
    const ob = conv.toCommon(RAW);
    expect(Number(ob.asks[0]?.price)).toBeGreaterThan(Number(ob.bids[0]?.price));
  });

  it('kind spot propagé', () => {
    expect(new OrderBookConverter('LIT/USDC', 'spot').toCommon(RAW).kind).toBe('spot');
  });
});
