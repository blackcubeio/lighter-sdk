import type { NativeTrade } from '../common/native';
import type { MarketKind, Side, UserTrade } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = ['size', 'price', 'timestamp', 'trade_id', 'market_id'] as const;

/**
 * Convertisseur fill de compte Lighter (`/trades` filtré par compte) → {@link UserTrade} unifié.
 * On déduit le sens et le rôle maker selon que le compte était côté ask ou bid. `accountIndex` et
 * `name` (symbole, résolu depuis `market_id`) portés par le constructeur. Lighter ne donne pas de
 * PnL/fee unifié par fill → `null` (détails en `xtras`). Unidirectionnel.
 */
export class UserTradeConverter {
  constructor(
    private readonly accountIndex: number,
    private readonly name: string,
    private readonly kind: MarketKind = 'perp',
  ) {}

  toCommon(raw: NativeTrade): UserTrade {
    const askId = raw.ask_account_id as number | undefined;
    const bidId = raw.bid_account_id as number | undefined;
    let side: Side = raw.is_maker_ask === true ? 'buy' : 'sell';
    let maker: boolean | null = null;
    let orderId = '';
    if (askId === this.accountIndex) {
      side = 'sell';
      maker = raw.is_maker_ask === true;
      orderId = String(raw.ask_id ?? raw.ask_id_str ?? '');
    } else if (bidId === this.accountIndex) {
      side = 'buy';
      maker = raw.is_maker_ask === false;
      orderId = String(raw.bid_id ?? raw.bid_id_str ?? '');
    }
    return {
      name: this.name,
      kind: this.kind,
      id: String(raw.trade_id ?? raw.trade_id_str ?? ''),
      orderId,
      side,
      price: raw.price,
      size: raw.size,
      fee: '0',
      feeAsset: null,
      pnl: null,
      maker,
      time: raw.timestamp,
      xtras: xtrasOf(raw, KNOWN),
    };
  }
}
