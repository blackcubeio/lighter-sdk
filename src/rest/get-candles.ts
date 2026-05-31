import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeCandlestick } from '../common/native';
import type { Candle, MarketKind } from '../common/types';
import { intervalToMs } from '../common/utils';
import { CandleConverter } from '../converters/candle';
import { httpGet } from './client';

interface CandlesEnvelope extends LighterEnvelope {
  c?: NativeCandlestick[];
}

/** Paramètres natifs (le `name`/`interval` servent au converter ; `marketId`/timestamps au wire). */
export interface GetCandlesQuery {
  marketId: number;
  name: string;
  interval: string;
  /** Début (ms). */
  startTime?: number;
  /** Fin (ms). */
  endTime?: number;
  /** Nombre de bougies. */
  limit?: number;
  /** Type de marché (pour le converter) ; défaut `perp`. */
  kind?: MarketKind;
}

const toSeconds = (ms: number): number => Math.floor(ms / 1000);

/**
 * Bougies au format unifié (`/api/v1/candles` — **pas** `/candlesticks`, qui est déprécié et
 * renvoie 403). `resolution` = intervalle unifié. `start/end_timestamp` (secondes) et `count_back`
 * sont requis par l'API → on applique des défauts sensés si absents.
 */
export function getCandles(
  client: LighterClient,
  query: GetCandlesQuery,
  label?: string,
): Promise<Candle[]> {
  const countBack = query.limit ?? 100;
  const end = query.endTime ?? Date.now();
  const span = intervalToMs(query.interval) || 60_000;
  const start = query.startTime ?? end - countBack * span;
  return httpGet<CandlesEnvelope>(
    client,
    '/api/v1/candles',
    {
      market_id: query.marketId,
      resolution: query.interval,
      start_timestamp: toSeconds(start),
      end_timestamp: toSeconds(end),
      count_back: countBack,
    },
    label,
  ).then((env) => {
    const converter = new CandleConverter(query.name, query.interval, query.kind ?? 'perp');
    return (env.c ?? []).map((c) => converter.toCommon(c));
  });
}
