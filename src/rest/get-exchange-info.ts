import type { LighterClient } from '../common/config';
import type { LighterEnvelope } from '../common/native';
import { httpGet } from './client';

/**
 * Métadonnées d'échange brutes (`/orderBookDetails`) — renvoyées telles quelles (non unifiées),
 * comme `getExchangeInfo` des autres SDK. `label` optionnel choisit le réseau (défaut mainnet).
 */
export function getExchangeInfo(client: LighterClient, label?: string): Promise<unknown> {
  return httpGet<LighterEnvelope>(client, '/api/v1/orderBookDetails', undefined, label);
}
