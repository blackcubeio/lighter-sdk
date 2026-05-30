import type { NativeTrade } from '../common/native';
import type { Side, Trade } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = ['size', 'price', 'timestamp', 'trade_id', 'is_maker_ask'] as const;

/**
 * Convertisseur trade public Lighter (`/recentTrades`, `/trades`, WS `trade`) → {@link Trade}.
 * `is_maker_ask` = le maker était côté ask ⇒ le **taker** (agresseur) a acheté (`buy`).
 * Unidirectionnel (les trades publics ne sont pas renvoyés vers l'exchange).
 */
export class TradeConverter {
  toCommon(raw: NativeTrade): Trade {
    let side: Side | null = null;
    if (raw.is_maker_ask === true) {
      side = 'buy';
    } else if (raw.is_maker_ask === false) {
      side = 'sell';
    }
    return {
      price: raw.price,
      size: raw.size,
      side,
      maker: null,
      time: raw.timestamp,
      id: raw.trade_id ?? null,
      xtras: xtrasOf(raw, KNOWN),
    };
  }
}
