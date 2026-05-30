import { describe, expect, it } from 'vitest';
import { decimalStep, intervalToMs, scaleToInt } from '../../src/common/utils';

describe('utils Lighter', () => {
  it('intervalToMs : minute/heure/jour/semaine, multiples, casse', () => {
    expect(intervalToMs('1m')).toBe(60_000);
    expect(intervalToMs('5m')).toBe(300_000);
    expect(intervalToMs('1h')).toBe(3_600_000);
    expect(intervalToMs('4h')).toBe(14_400_000);
    expect(intervalToMs('1d')).toBe(86_400_000);
    expect(intervalToMs('1w')).toBe(604_800_000);
    expect(intervalToMs('1H')).toBe(3_600_000); // insensible à la casse
  });

  it('intervalToMs : intervalle non reconnu ⇒ 0', () => {
    expect(intervalToMs('bogus')).toBe(0);
    expect(intervalToMs('1y')).toBe(0);
  });

  it('decimalStep : 10^-decimals en chaîne', () => {
    expect(decimalStep(0)).toBe('1');
    expect(decimalStep(1)).toBe('0.1');
    expect(decimalStep(5)).toBe('0.00001');
  });

  it('scaleToInt : value * 10^decimals arrondi', () => {
    expect(scaleToInt('73969.4', 1)).toBe(739694);
    expect(scaleToInt('0.001', 5)).toBe(100);
    expect(scaleToInt(10.5, 6)).toBe(10_500_000);
  });
});
