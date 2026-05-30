import { describe, expect, it } from 'vitest';
import { SubAccountConverter } from '../../src/converters/subaccount';

describe('SubAccountConverter Lighter', () => {
  const conv = new SubAccountConverter();

  it('address = adresse L1 si fournie ; le reste dans xtras', () => {
    const s = conv.toCommon({ account_index: 349, l1_address: '0xABC', collateral: '100' });
    expect(s.address).toBe('0xABC');
    expect((s.xtras as Record<string, unknown>).account_index).toBe(349);
    expect((s.xtras as Record<string, unknown>).collateral).toBe('100');
  });

  it('repli sur l’index du compte si pas d’adresse L1', () => {
    expect(conv.toCommon({ index: 708287 }).address).toBe('708287');
  });

  it('xtras omis si rien hors cœur', () => {
    expect(conv.toCommon({ l1_address: '0xABC' }).xtras).toBeUndefined();
  });
});
