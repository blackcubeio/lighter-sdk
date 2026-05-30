import type { LighterClient } from '../common/config';
import type { MarketKind, Price } from '../common/types';
import { PriceConverter } from '../converters/price';
import { fetchMarketMetas } from './get-pairs';

/**
 * Snapshot de prix de tous les marchés au format unifié, dérivé de `/orderBookDetails`
 * (dernier prix, open interest, volume 24h). `label` optionnel choisit le réseau (défaut mainnet).
 */
export function getPrices(
  client: LighterClient,
  label?: string,
  kind?: MarketKind,
): Promise<Price[]> {
  const converter = new PriceConverter();
  return fetchMarketMetas(client, label).then((metas) =>
    metas
      .filter((m) => kind === undefined || (m.market_type === 'spot' ? 'spot' : 'perp') === kind)
      .map((m) => converter.toCommon(m)),
  );
}
