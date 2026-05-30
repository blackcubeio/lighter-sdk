import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeBookOrder } from '../common/native';
import type { MarketKind, OrderBook } from '../common/types';
import { OrderBookConverter } from '../converters/order-book';
import { httpGet } from './client';

interface OrderBookOrdersEnvelope extends LighterEnvelope {
  asks?: NativeBookOrder[];
  bids?: NativeBookOrder[];
}

export interface GetOrderBookQuery {
  marketId: number;
  name: string;
  /** Profondeur (nombre d'ordres demandés par côté). */
  limit?: number;
  /** Type de marché (pour le converter) ; défaut `perp`. */
  kind?: MarketKind;
}

/** Carnet d'ordres au format unifié (agrégé par prix). */
export function getOrderBook(
  client: LighterClient,
  query: GetOrderBookQuery,
  label?: string,
): Promise<OrderBook> {
  return httpGet<OrderBookOrdersEnvelope>(
    client,
    '/api/v1/orderBookOrders',
    { market_id: query.marketId, limit: query.limit ?? 100 },
    label,
  ).then((env) =>
    new OrderBookConverter(query.name, query.kind ?? 'perp').toCommon({
      asks: env.asks,
      bids: env.bids,
    }),
  );
}
