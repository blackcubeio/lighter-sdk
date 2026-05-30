import { describe, expect, it } from 'vitest';
import type { NativeFunding } from '../../src/common/native';
import { FundingConverter } from '../../src/converters/funding';

const BASE: NativeFunding = {
  timestamp: 1_780_142_400, // secondes
  value: '0.88308360',
  rate: '0.0012',
  direction: 'long',
};

describe('FundingConverter Lighter', () => {
  const conv = new FundingConverter('BTC');

  it('direction long ⇒ taux positif, timestamp s → ms, value en xtras', () => {
    const f = conv.toCommon(BASE);
    expect(f.name).toBe('BTC');
    expect(f.fundingRate).toBe('0.0012');
    expect(f.time).toBe(1_780_142_400_000);
    expect((f.xtras as Record<string, unknown>).value).toBe('0.88308360');
  });

  it('direction short ⇒ taux signé négatif', () => {
    expect(conv.toCommon({ ...BASE, direction: 'short' }).fundingRate).toBe('-0.0012');
  });

  it('porte le name fourni au constructeur', () => {
    expect(new FundingConverter('ETH').toCommon(BASE).name).toBe('ETH');
  });
});
