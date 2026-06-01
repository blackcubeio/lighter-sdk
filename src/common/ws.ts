import type { WebSocketFactory } from './config';
import type { JsonValue } from './types';

/** Annule un abonnement WebSocket. */
export type Unsubscribe = () => void;

/** Handler d'un flux de marché : reçoit le payload brut. */
export type StreamHandler = (data: JsonValue) => void;

/** Handler d'un événement user-data : reçoit l'événement brut. */
export type EventHandler = (event: JsonValue) => void;

// ── ws/client.ts ──
export interface WsClientOptions {
  url?: string;
  webSocket?: WebSocketFactory;
  /** Label du signer : choisit le réseau (défaut mainnet). */
  label?: string;
  /** Intervalle du heartbeat applicatif (ms). Défaut `30_000` (cf. spec robustesse WS commune). */
  heartbeatIntervalMs?: number;
}

// ── ws/unified-client.ts ──
export interface UnifiedWsOptions {
  /** Label du signer : choisit le réseau (défaut mainnet). */
  label?: string;
  webSocket?: WebSocketFactory;
}
