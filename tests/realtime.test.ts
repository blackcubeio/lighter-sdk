import { describe, expect, it } from 'vitest';
import type { Candle, OrderBook, Price } from '../src/common/types';
import { Lighter } from '../src/dex/lighter';

const dex = new Lighter();

const first = <T>(subscribe: (cb: (v: T) => void) => () => void, timeoutMs = 12_000) =>
  new Promise<T>((resolve, reject) => {
    const unsub = subscribe((v) => {
      unsub();
      resolve(v);
    });
    setTimeout(() => {
      unsub();
      reject(new Error('timeout WS'));
    }, timeoutMs);
  });

describe('Lighter — temps réel via dex.ws() (mainnet réel)', () => {
  it('subscribeOrderBook résout name → market_id et fusionne snapshot+deltas', async () => {
    const ws = dex.ws();
    const book = await first<OrderBook>((cb) => ws.subscribeOrderBook({ name: 'BTC' }, cb));
    expect(book.name).toBe('BTC');
    expect(book.bids.length).toBeGreaterThan(0);
    expect(Number(book.asks[0]?.price)).toBeGreaterThan(Number(book.bids[0]?.price));
  });

  it('subscribeCandles (le flux WS fonctionne même si le REST candles est filtré)', async () => {
    const ws = dex.ws();
    const candle = await first<Candle>((cb) =>
      ws.subscribeCandles({ name: 'BTC', interval: '1m' }, cb),
    );
    expect(candle.s).toBe('BTC');
    expect(candle.i).toBe('1m');
    expect(Number(candle.o)).toBeGreaterThan(0);
  });

  it('subscribeBbo donne la meilleure limite', async () => {
    const ws = dex.ws();
    const bbo = await first<OrderBook>((cb) => ws.subscribeBbo({ name: 'BTC' }, cb));
    expect(bbo.bids.length).toBeLessThanOrEqual(1);
    expect(bbo.asks.length).toBeLessThanOrEqual(1);
  });

  it('subscribePrices émet un tableau de prix (fan-out market_stats)', async () => {
    const ws = dex.ws();
    const prices = await first<Price[]>((cb) => ws.subscribePrices(cb));
    expect(Array.isArray(prices)).toBe(true);
    expect(prices.length).toBeGreaterThan(0);
    expect(prices[0]?.mark).not.toBeUndefined();
  });
});
