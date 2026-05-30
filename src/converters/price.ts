import type { NativeOrderBookMeta } from '../common/native';
import type { Price } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = ['symbol', 'last_trade_price', 'open_interest', 'daily_quote_token_volume'] as const;

/**
 * Convertisseur prix Lighter : métadonnée `orderBookDetails` → {@link Price} unifié. Lighter ne
 * publie pas de mark/oracle/mid distincts dans ce flux : on remplit `last`, `openInterest` et
 * `volume24h` ; le reste est `null`. Le funding (endpoint séparé) reste `null`. Unidirectionnel.
 */
export class PriceConverter {
  toCommon(meta: NativeOrderBookMeta): Price {
    return {
      name: meta.symbol,
      kind: meta.market_type === 'spot' ? 'spot' : 'perp',
      mark: null,
      oracle: null,
      mid: null,
      bid: null,
      ask: null,
      last: meta.last_trade_price !== undefined ? String(meta.last_trade_price) : null,
      funding: null,
      openInterest: meta.open_interest !== undefined ? String(meta.open_interest) : null,
      volume24h:
        meta.daily_quote_token_volume !== undefined ? String(meta.daily_quote_token_volume) : null,
      prevDayPrice: null,
      time: null,
      xtras: xtrasOf(meta, KNOWN),
    };
  }
}
