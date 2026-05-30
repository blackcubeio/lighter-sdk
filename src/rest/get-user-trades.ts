import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeTrade } from '../common/native';
import type { MarketKind, UserTrade } from '../common/types';
import { UserTradeConverter } from '../converters/user-trade';
import { httpGet } from './client';

interface TradesEnvelope extends LighterEnvelope {
  trades?: NativeTrade[];
}

export interface UserTradesQuery {
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

/** Exécutions (fills) d'un compte sur un marché (`/trades`, requiert `auth`). */
export function getUserTrades(
  client: LighterClient,
  query: UserTradesQuery,
  label?: string,
): Promise<UserTrade[]> {
  return httpGet<TradesEnvelope>(
    client,
    '/api/v1/trades',
    {
      account_index: query.accountIndex,
      market_id: query.marketId,
      auth: query.auth,
      limit: query.limit ?? 100,
    },
    label,
  ).then((env) => {
    const converter = new UserTradeConverter(query.accountIndex, query.name, query.kind ?? 'perp');
    return (env.trades ?? []).map((t) => converter.toCommon(t));
  });
}
