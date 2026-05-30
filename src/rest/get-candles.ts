import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeCandlestick } from '../common/native';
import type { Candle, MarketKind } from '../common/types';
import { CandleConverter } from '../converters/candle';
import { httpGet } from './client';

interface CandlesticksEnvelope extends LighterEnvelope {
  candlesticks?: NativeCandlestick[];
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

const toSeconds = (ms?: number): number | undefined =>
  ms === undefined ? undefined : Math.floor(ms / 1000);

/** Bougies au format unifié. `resolution` = intervalle unifié (pass-through). */
export function getCandles(
  client: LighterClient,
  query: GetCandlesQuery,
  label?: string,
): Promise<Candle[]> {
  return httpGet<CandlesticksEnvelope>(
    client,
    '/api/v1/candlesticks',
    {
      market_id: query.marketId,
      resolution: query.interval,
      start_timestamp: toSeconds(query.startTime),
      end_timestamp: toSeconds(query.endTime),
      count_back: query.limit,
    },
    label,
  ).then((env) => {
    const converter = new CandleConverter(query.name, query.interval, query.kind ?? 'perp');
    return (env.candlesticks ?? []).map((c) => converter.toCommon(c));
  });
}
