import type { LighterClient } from '../common/config';
import type { LighterEnvelope } from '../common/native';
import type { Network, QueryParams } from '../common/types';

/**
 * Réseau d'une **lecture**. Le label est optionnel : sans label on retombe sur le **mainnet**
 * (les lectures ne touchent pas au wallet) ; avec un label on tape sur le réseau de son signer.
 */
export function resolveReadNetwork(client: LighterClient, label?: string): Network {
  if (label === undefined) {
    return 'mainnet';
  }
  const signer = client.signers[label];
  if (signer === undefined) {
    throw new Error(`Aucun signer enregistré sous "${label}"; ajoute-le dans init({ signers })`);
  }
  return signer.network;
}

export class LighterApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'LighterApiError';
  }
}

export function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const url = new URL(baseUrl + path);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/** Lecture (non signée). `label` optionnel choisit le réseau (défaut mainnet). */
export function httpGet<TData extends LighterEnvelope>(
  client: LighterClient,
  path: string,
  query?: QueryParams,
  label?: string,
): Promise<TData> {
  const url = buildUrl(client.restUrls[resolveReadNetwork(client, label)], path, query);
  return client
    .fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
    .then((response) => parseEnvelope<TData>(response));
}

function parseEnvelope<TData extends LighterEnvelope>(response: Response): Promise<TData> {
  return response.text().then((body) => {
    let parsed: TData | null = null;
    if (body !== '') {
      try {
        parsed = JSON.parse(body) as TData;
      } catch {
        parsed = null;
      }
    }
    if (response.ok === false) {
      const message = parsed?.message ?? (body === '' ? `HTTP ${response.status}` : body);
      throw new LighterApiError(response.status, parsed?.code ?? null, message);
    }
    if (parsed === null) {
      throw new LighterApiError(response.status, null, body === '' ? 'Empty response' : body);
    }
    // Lighter signale ses erreurs applicatives via `code` (200 = OK) même en HTTP 200.
    if (typeof parsed.code === 'number' && parsed.code !== 200) {
      throw new LighterApiError(response.status, parsed.code, parsed.message ?? 'Request failed');
    }
    return parsed;
  });
}
