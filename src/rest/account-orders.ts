import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeOrder } from '../common/native';
import type { MarketKind, Order } from '../common/types';
import { OrderConverter } from '../converters/order';
import { httpGet } from './client';

interface OrdersEnvelope extends LighterEnvelope {
  orders?: NativeOrder[];
}

export interface AccountOrdersQuery {
  accountIndex: number;
  marketId: number;
  /** Symbole, pour le converter. */
  name: string;
  /** Token d'authentification (cf. {@link getAuthToken}). */
  auth: string;
  limit?: number;
  /** Type de marché (pour le converter) ; défaut `perp`. */
  kind?: MarketKind;
}

/** Ordres **actifs** d'un compte sur un marché (`/accountActiveOrders`, requiert `auth`). */
export function getActiveOrders(
  client: LighterClient,
  query: AccountOrdersQuery,
  label?: string,
): Promise<Order[]> {
  return httpGet<OrdersEnvelope>(
    client,
    '/api/v1/accountActiveOrders',
    { account_index: query.accountIndex, market_id: query.marketId, auth: query.auth },
    label,
  ).then((env) => {
    const converter = new OrderConverter(query.name, query.kind ?? 'perp');
    return (env.orders ?? []).map((o) => converter.toCommon(o));
  });
}

/** Ordres **inactifs** (historique) d'un compte (`/accountInactiveOrders`, requiert `auth`). */
export function getInactiveOrders(
  client: LighterClient,
  query: AccountOrdersQuery,
  label?: string,
): Promise<Order[]> {
  return httpGet<OrdersEnvelope>(
    client,
    '/api/v1/accountInactiveOrders',
    {
      account_index: query.accountIndex,
      market_id: query.marketId,
      auth: query.auth,
      limit: query.limit ?? 50,
    },
    label,
  ).then((env) => {
    const converter = new OrderConverter(query.name, query.kind ?? 'perp');
    return (env.orders ?? []).map((o) => converter.toCommon(o));
  });
}
