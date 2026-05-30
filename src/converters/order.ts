import type { NativeOrder } from '../common/native';
import type { MarketKind, Order } from '../common/types';
import { xtrasOf } from './xtras';

const KNOWN = [
  'order_id',
  'order_index',
  'client_order_id',
  'initial_base_amount',
  'filled_base_amount',
  'price',
  'is_ask',
  'type',
  'time_in_force',
  'reduce_only',
  'status',
  'timestamp',
] as const;

const TYPE_MAP: Record<string, Order['type']> = {
  limit: 'limit',
  market: 'market',
  'stop-loss': 'stop',
  'stop-loss-limit': 'stop',
  'take-profit': 'takeProfit',
  'take-profit-limit': 'takeProfit',
  twap: 'other',
  'twap-sub': 'other',
  liquidation: 'other',
};

const TIF_MAP: Record<string, Order['tif']> = {
  'good-till-time': 'gtc',
  'immediate-or-cancel': 'ioc',
  'post-only': 'alo',
};

function mapStatus(status: string | undefined, initial: string, filled: string): Order['status'] {
  if (status === undefined) {
    return 'other';
  }
  if (status === 'filled') {
    return 'filled';
  }
  if (status === 'open' || status === 'pending' || status === 'in-progress') {
    return Number(filled) > 0 && Number(filled) < Number(initial) ? 'partiallyFilled' : 'open';
  }
  if (status === 'canceled-expired') {
    return 'expired';
  }
  if (status.startsWith('canceled')) {
    return 'canceled';
  }
  return 'other';
}

/**
 * Convertisseur ordre de compte Lighter (`/accountActiveOrders`, `/accountInactiveOrders`) →
 * {@link Order} unifié. `name` (symbole, résolu depuis `market_index`) porté par le constructeur.
 * `is_ask` ⇒ vente. Unidirectionnel.
 */
export class OrderConverter {
  constructor(
    private readonly name: string,
    private readonly kind: MarketKind = 'perp',
  ) {}

  toCommon(raw: NativeOrder): Order {
    const initial = raw.initial_base_amount;
    const filled = raw.filled_base_amount ?? '0';
    return {
      name: this.name,
      kind: this.kind,
      id: raw.order_id ?? String(raw.order_index ?? ''),
      clientId: raw.client_order_id ?? null,
      side: raw.is_ask ? 'sell' : 'buy',
      type: raw.type !== undefined ? (TYPE_MAP[raw.type] ?? 'other') : 'other',
      price: raw.price,
      size: initial,
      filled,
      status: mapStatus(raw.status, initial, filled),
      tif: raw.time_in_force !== undefined ? (TIF_MAP[raw.time_in_force] ?? null) : null,
      reduceOnly: raw.reduce_only ?? null,
      time: raw.timestamp ?? 0,
      xtras: xtrasOf(raw, KNOWN),
    };
  }
}
