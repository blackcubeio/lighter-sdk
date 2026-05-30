import type { NativeOrderBookMeta } from '../common/native';
import type { Pair } from '../common/types';
import { decimalStep } from '../common/utils';
import { xtrasOf } from './xtras';

const KNOWN = [
  'symbol',
  'market_type',
  'status',
  'supported_size_decimals',
  'supported_price_decimals',
  'min_quote_amount',
  'min_initial_margin_fraction',
  'default_initial_margin_fraction',
] as const;

/**
 * Convertisseur paire : métadonnée de marché Lighter (`orderBooks`/`orderBookDetails`) →
 * {@link Pair} unifiée. Lighter est perp-only ; le quote est implicitement USDC. Le levier max
 * se déduit de la fraction de marge initiale minimale (bps : `10000` = 1×).
 */
export class PairConverter {
  toCommon(meta: NativeOrderBookMeta): Pair {
    const sizeDecimals = meta.supported_size_decimals ?? meta.size_decimals ?? 0;
    const priceDecimals = meta.supported_price_decimals ?? meta.price_decimals ?? 0;
    const marginFraction = meta.min_initial_margin_fraction ?? meta.default_initial_margin_fraction;
    const maxLeverage =
      marginFraction !== undefined && marginFraction > 0
        ? Math.floor(10_000 / marginFraction)
        : undefined;
    // Spot : symbole `BASE/QUOTE` (ex. `LIT/USDC`). Perp : `BASE` (quote implicite USDC).
    const [base, quote] = meta.symbol.includes('/')
      ? (meta.symbol.split('/') as [string, string])
      : [meta.symbol, 'USDC'];
    return {
      name: meta.symbol,
      base,
      quote,
      kind: meta.market_type === 'spot' ? 'spot' : 'perp',
      szDecimals: sizeDecimals,
      ...(maxLeverage !== undefined ? { maxLeverage } : {}),
      tickSize: decimalStep(priceDecimals),
      stepSize: decimalStep(sizeDecimals),
      ...(meta.min_quote_amount !== undefined ? { minNotional: meta.min_quote_amount } : {}),
      status: meta.status,
      xtras: xtrasOf(meta, KNOWN),
    };
  }
}
