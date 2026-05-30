import type { LighterClient } from '../common/config';
import type { LighterEnvelope } from '../common/native';
import { httpGet } from './client';

interface NonceEnvelope extends LighterEnvelope {
  nonce?: number;
}

/** Prochain nonce **public** d'une API key (`/nextNonce`). */
export function getNextNonce(
  client: LighterClient,
  accountIndex: number,
  apiKeyIndex: number,
  label?: string,
): Promise<number> {
  return httpGet<NonceEnvelope>(
    client,
    '/api/v1/nextNonce',
    { account_index: accountIndex, api_key_index: apiKeyIndex },
    label,
  ).then((env) => env.nonce ?? 0);
}
