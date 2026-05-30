import { REST_URL, TESTNET_REST_URL, TESTNET_WS_URL, WS_URL } from './constants';
import type { Network, Signer } from './types';

export type { Network };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export interface InitOptions {
  fetch?: FetchLike;
  webSocket?: WebSocketFactory;
  /** Registre de signers indexés par label. Chaque signer porte son propre réseau. */
  signers?: Record<string, Signer>;
  /** Override de l'URL REST de base par réseau. */
  restUrls?: Partial<Record<Network, string>>;
  /** Override de l'URL WebSocket de base par réseau. */
  wsUrls?: Partial<Record<Network, string>>;
}

/**
 * Contexte d'exécution **isolé** d'un SDK Lighter : tout ce dont les fonctions REST/WS ont
 * besoin (fetch, urls, signers). Créé par {@link init} et **passé explicitement** à chaque
 * fonction (`getCandles(client, …)`) — il n'y a **plus de singleton global**, donc plusieurs
 * clients (comptes/réseaux différents) coexistent sans se piétiner.
 *
 * ⚠️ **Une seule exception au modèle** : la signature Lighter passe par un **signer WASM**
 * (lib crypto officielle `lighter-go` compilée en WebAssembly). Ce module WASM est un
 * **singleton de process** avec un registre de clients indexé par `(apiKeyIndex, accountIndex)`.
 * Les lectures publiques n'en ont **aucun** besoin ; il est chargé en **lazy** au premier appel
 * signé (trading / token d'auth), comme le WS lazy-connect. REST/WS restent isolés par instance.
 */
export interface LighterClient {
  fetch: FetchLike;
  webSocket: WebSocketFactory;
  signers: Record<string, Signer>;
  restUrls: Record<Network, string>;
  wsUrls: Record<Network, string>;
}

/** Construit un {@link LighterClient} isolé à partir des options. Aucun état global muté. */
export function init(options: InitOptions = {}): LighterClient {
  const fetchImpl =
    options.fetch ??
    (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
  if (fetchImpl === undefined) {
    throw new Error('No fetch implementation available; pass options.fetch to init()');
  }
  const webSocket = options.webSocket ?? defaultWebSocketFactory();
  if (webSocket === undefined) {
    throw new Error('No WebSocket implementation available; pass options.webSocket to init()');
  }
  return {
    fetch: fetchImpl,
    webSocket,
    signers: options.signers ?? {},
    restUrls: {
      mainnet: options.restUrls?.mainnet ?? REST_URL,
      testnet: options.restUrls?.testnet ?? TESTNET_REST_URL,
    },
    wsUrls: {
      mainnet: options.wsUrls?.mainnet ?? WS_URL,
      testnet: options.wsUrls?.testnet ?? TESTNET_WS_URL,
    },
  };
}

function defaultWebSocketFactory(): WebSocketFactory | undefined {
  if (typeof globalThis.WebSocket !== 'function') {
    return undefined;
  }
  return (url) => new globalThis.WebSocket(url) as unknown as WebSocketLike;
}
