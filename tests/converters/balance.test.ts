import { describe, expect, it } from 'vitest';
import type { NativeAccount } from '../../src/common/native';
import { BalanceConverter } from '../../src/converters/balance';

const ACCOUNT: NativeAccount = {
  account_index: 349,
  collateral: '9900.000000',
  available_balance: '9900.000000',
  assets: [
    { symbol: 'ETH', asset_id: 1, balance: '3.0', locked_balance: '0', margin_balance: '0' },
    { symbol: 'LIT', asset_id: 2, balance: '1000000.0', locked_balance: '0', margin_balance: '0' },
    { symbol: 'USDC', asset_id: 3, balance: '0', locked_balance: '0', margin_balance: '9900.0' },
  ],
};

describe('BalanceConverter Lighter', () => {
  const conv = new BalanceConverter();

  it('un Balance par actif spot ; total = balance + margin_balance', () => {
    const out = conv.toCommon(ACCOUNT);
    expect(out.map((b) => [b.asset, b.total])).toEqual([
      ['ETH', '3'],
      ['LIT', '1000000'],
      ['USDC', '9900'], // collatéral perp porté par margin_balance
    ]);
  });

  it('available = balance - locked + margin', () => {
    const usdc = conv.toCommon(ACCOUNT).find((b) => b.asset === 'USDC');
    expect(usdc?.available).toBe('9900');
  });

  it('repli sur un seul USDC (collateral) si assets absent', () => {
    const out = conv.toCommon({ account_index: 1, collateral: '500' });
    expect(out).toEqual([{ asset: 'USDC', total: '500', available: null, usdValue: '500' }]);
  });
});
