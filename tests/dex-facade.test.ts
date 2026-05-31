import { describe, expect, it } from 'vitest';
import { Lighter } from '../src/dex/lighter';

// Lectures publiques via la **classe** Lighter, contre le **vrai mainnet** (aucun mock).
const dex = new Lighter();

describe('Lighter — façade & lectures publiques (mainnet réel)', () => {
  it('expose les scopes unifiés (dont transfers) + le namespace native (apiKeys/subAccounts/pools/staking/accountConfig), pas de system', () => {
    expect(typeof dex.perp).toBe('function');
    expect(typeof dex.spot).toBe('function');
    expect(typeof dex.account).toBe('function');
    expect(typeof dex.transfers).toBe('function');
    expect(typeof dex.ws).toBe('function');
    expect(typeof dex.wsSpot).toBe('function');
    for (const c of ['apiKeys', 'subAccounts', 'pools', 'staking', 'accountConfig']) {
      expect(typeof (dex.native as Record<string, unknown>)[c]).toBe('function');
    }
    // `transfers` est COMMUN (top-level), plus dans native.
    expect((dex.native as Record<string, unknown>).transfers).toBeUndefined();
    // Les anciens scopes top-level ont migré sous `native` (plus de top-level).
    expect((dex as unknown as Record<string, unknown>).apiKeys).toBeUndefined();
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

  it('perp().getTrades({ name: BTC })', async () => {
    const trades = await dex.perp().getTrades({ name: 'BTC', limit: 3 });
    expect(trades.length).toBeGreaterThan(0);
    expect(Number(trades[0]?.price)).toBeGreaterThan(0);
  });

  it('perp().getPrices() inclut BTC', async () => {
    const prices = await dex.perp().getPrices();
    const btc = prices.find((p) => p.name === 'BTC');
    expect(btc).toBeDefined();
    expect(btc?.kind).toBe('perp');
  });

  it('perp().getFundingHistory({ name: BTC })', async () => {
    const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
    const now = Date.now();
    const funding = await dex.perp().getFundingHistory({
      name: 'BTC',
      startTime: fmt(now - 6 * 3600_000),
      endTime: fmt(now),
      limit: 3,
    });
    expect(funding.length).toBeGreaterThan(0);
    expect(funding[0]?.name).toBe('BTC');
  });

  it('perp().getExchangeInfo()', async () => {
    expect(await dex.perp().getExchangeInfo()).toBeDefined();
  });

  it('perp().getCandles({ name: BTC, interval: 1h }) — endpoint /candles', async () => {
    const candles = await dex.perp().getCandles({ name: 'BTC', interval: '1h', limit: 5 });
    expect(candles.length).toBeGreaterThan(0);
    const c = candles[0];
    expect(c?.s).toBe('BTC');
    expect(c?.i).toBe('1h');
    expect(c?.kind).toBe('perp');
    expect(Number(c?.o)).toBeGreaterThan(0);
    expect(c?.t).toBeGreaterThan(1_700_000_000_000); // open time en ms
  });

  it('spot().getOrderBook résout un marché spot (BASE/QUOTE)', async () => {
    const spots = await dex.spot().getPairs();
    const name = spots[0]?.name as string;
    const ob = await dex.spot().getOrderBook({ name, limit: 5 });
    expect(ob.name).toBe(name);
    expect(ob.kind).toBe('spot');
  });

  it('lectures de compte publiques par index (positions/soldes du compte testnet)', async () => {
    // compte public connu (l'index du main testnet du wallet de dev)
    const reader = new Lighter({
      acc: { apiPrivateKey: '0x00', apiKeyIndex: 0, accountIndex: 349, network: 'testnet' },
    });
    const positions = await reader.perp('acc').getPositions();
    const balances = await reader.account('acc').getBalances();
    expect(Array.isArray(positions)).toBe(true);
    expect(balances.find((b) => b.asset === 'USDC')).toBeDefined();
  });
});
