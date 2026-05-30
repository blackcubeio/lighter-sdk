import { describe, expect, it } from 'vitest';
import { Lighter } from '../src/dex/lighter';

// Lectures publiques via la **classe** Lighter, contre le **vrai mainnet** (aucun mock).
const dex = new Lighter();

describe('Lighter — façade & lectures publiques (mainnet réel)', () => {
  it('expose les scopes attendus (perp/spot/ws/wsSpot/account/apiKeys/subAccounts/transfers, pas de system)', () => {
    expect(typeof dex.perp).toBe('function');
    expect(typeof dex.spot).toBe('function');
    expect(typeof dex.account).toBe('function');
    expect(typeof dex.ws).toBe('function');
    expect(typeof dex.wsSpot).toBe('function');
    expect(typeof dex.apiKeys).toBe('function');
    expect(typeof dex.subAccounts).toBe('function');
    expect(typeof dex.transfers).toBe('function');
    // Lighter n'a pas d'endpoint système (ping/horloge) → pas de scope system().
    expect((dex as unknown as Record<string, unknown>).system).toBeUndefined();
  });

  it('getPairs distingue perp et spot', async () => {
    const perps = await dex.perp().getPairs();
    const spots = await dex.spot().getPairs();
    expect(perps.length).toBeGreaterThan(0);
    expect(spots.length).toBeGreaterThan(0);
    expect(perps.every((p) => p.kind === 'perp')).toBe(true);
    expect(spots.every((p) => p.kind === 'spot')).toBe(true);
  });

  it('perp().getPairs()', async () => {
    const pairs = await dex.perp().getPairs();
    expect(pairs.length).toBeGreaterThan(0);
    const btc = pairs.find((p) => p.name === 'BTC');
    expect(btc?.kind).toBe('perp');
    expect(btc?.quote).toBe('USDC');
    expect(Number(btc?.szDecimals)).toBeGreaterThanOrEqual(0);
  });

  it('perp().getOrderBook({ name: BTC }) résout name → market_id', async () => {
    const ob = await dex.perp().getOrderBook({ name: 'BTC', limit: 10 });
    expect(ob.name).toBe('BTC');
    expect(ob.bids.length).toBeGreaterThan(0);
    expect(Number(ob.asks[0]?.price)).toBeGreaterThan(Number(ob.bids[0]?.price));
  });

  it('perp().getTrades + getPrices + getFundingHistory + getExchangeInfo', async () => {
    const trades = await dex.perp().getTrades({ name: 'BTC', limit: 3 });
    expect(trades.length).toBeGreaterThan(0);

    const prices = await dex.perp().getPrices();
    expect(prices.find((p) => p.name === 'BTC')).toBeDefined();

    const now = Date.now();
    const funding = await dex.perp().getFundingHistory({
      name: 'BTC',
      startTime: now - 6 * 3600_000,
      endTime: now,
      limit: 3,
    });
    expect(funding.length).toBeGreaterThan(0);
    expect(funding[0]?.name).toBe('BTC');

    const info = await dex.perp().getExchangeInfo();
    expect(info).toBeDefined();
  });
});
