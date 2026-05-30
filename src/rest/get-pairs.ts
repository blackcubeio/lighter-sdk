import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeOrderBookMeta } from '../common/native';
import type { MarketKind, Pair } from '../common/types';
import { PairConverter } from '../converters/pair';
import { httpGet } from './client';

interface OrderBookDetailsEnvelope extends LighterEnvelope {
  order_book_details?: NativeOrderBookMeta[];
}

interface OrderBooksEnvelope extends LighterEnvelope {
  order_books?: NativeOrderBookMeta[];
}

/**
 * Récupère les métadonnées de **tous** les marchés (perp **et** spot) en fusionnant deux endpoints :
 * `/orderBooks` liste tout (perp+spot, avec décimales) tandis que `/orderBookDetails` ne renvoie que
 * les perp mais avec des champs **plus riches** (prix, OI, fraction de marge → levier). On part de
 * `orderBooks` et on écrase chaque perp par sa version détaillée. Sert de source à {@link getPairs}
 * et de table de résolution `symbol/kind → market_id`/décimales pour la façade.
 */
export function fetchMarketMetas(
  client: LighterClient,
  label?: string,
): Promise<NativeOrderBookMeta[]> {
  return Promise.all([
    httpGet<OrderBooksEnvelope>(client, '/api/v1/orderBooks', undefined, label),
    httpGet<OrderBookDetailsEnvelope>(client, '/api/v1/orderBookDetails', undefined, label),
  ]).then(([books, details]) => {
    const byId = new Map<number, NativeOrderBookMeta>();
    for (const meta of books.order_books ?? []) {
      byId.set(meta.market_id, meta);
    }
    for (const meta of details.order_book_details ?? []) {
      byId.set(meta.market_id, meta); // version détaillée (perp) plus riche → prioritaire
    }
    return [...byId.values()];
  });
}

/** Liste des paires au format unifié, filtrée par type de marché si `kind` est fourni. */
export function getPairs(
  client: LighterClient,
  label?: string,
  kind?: MarketKind,
): Promise<Pair[]> {
  const converter = new PairConverter();
  return fetchMarketMetas(client, label).then((metas) =>
    metas
      .filter((m) => kind === undefined || (m.market_type === 'spot' ? 'spot' : 'perp') === kind)
      .map((m) => converter.toCommon(m)),
  );
}
