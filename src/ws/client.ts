import type { LighterClient, WebSocketFactory, WebSocketLike } from '../common/config';
import type { JsonValue, Network } from '../common/types';
import type { StreamHandler, Unsubscribe, WsClientOptions } from '../common/ws';

/**
 * Client WebSocket natif Lighter (un endpoint `wss://…/stream`). **Lazy** : la socket s'ouvre au
 * 1er abonnement et se ferme au dernier (ref-counting par channel). Les `send()` émis avant
 * `onopen` sont **bufferisés** puis rejoués. Les messages sont routés par channel : Lighter
 * répond avec un `channel` en forme `order_book:1` qu'on normalise vers la forme d'abonnement
 * `order_book/1`.
 */
export class LighterWsClient {
  private readonly url: string;
  private readonly factory: WebSocketFactory;
  private socket: WebSocketLike | null = null;
  private open = false;
  private pending: string[] = [];
  private readonly handlers = new Map<string, Set<StreamHandler>>();

  constructor(client: LighterClient, options: WsClientOptions = {}) {
    const network: Network =
      options.label !== undefined
        ? (client.signers[options.label]?.network ?? 'mainnet')
        : 'mainnet';
    this.url = options.url ?? client.wsUrls[network];
    this.factory = options.webSocket ?? client.webSocket;
  }

  /**
   * Abonne `handler` à `channel` (forme `order_book/1`). Ouvre la socket si nécessaire.
   * `extra` ajoute des champs au message de souscription (ex. `auth` pour les channels privés).
   */
  subscribe(channel: string, handler: StreamHandler, extra?: Record<string, unknown>): Unsubscribe {
    let set = this.handlers.get(channel);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(channel, set);
      this.ensureOpen();
      this.send({ type: 'subscribe', channel, ...extra });
    }
    set.add(handler);

    return () => {
      const current = this.handlers.get(channel);
      if (current === undefined) {
        return;
      }
      current.delete(handler);
      if (current.size === 0) {
        this.handlers.delete(channel);
        this.send({ type: 'unsubscribe', channel });
        if (this.handlers.size === 0) {
          this.close();
        }
      }
    };
  }

  private ensureOpen(): void {
    if (this.socket !== null) {
      return;
    }
    const socket = this.factory(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.open = true;
      const buffered = this.pending;
      this.pending = [];
      for (const message of buffered) {
        socket.send(message);
      }
    };
    socket.onmessage = (event) => {
      this.dispatch(event.data);
    };
    socket.onclose = () => {
      this.open = false;
      this.socket = null;
    };
    socket.onerror = () => {
      // Erreurs remontées via la fermeture ; pas de throw asynchrone.
    };
  }

  private send(payload: Record<string, unknown>): void {
    const message = JSON.stringify(payload);
    if (this.open && this.socket !== null) {
      this.socket.send(message);
    } else {
      this.pending.push(message);
    }
  }

  private dispatch(raw: unknown): void {
    let message: JsonValue;
    try {
      message = JSON.parse(String(raw)) as JsonValue;
    } catch {
      return;
    }
    if (message === null || typeof message !== 'object' || Array.isArray(message)) {
      return;
    }
    const channel = message.channel;
    if (typeof channel !== 'string') {
      return;
    }
    const normalized = channel.replace(/:/g, '/');
    const set = this.handlers.get(normalized);
    if (set === undefined) {
      return;
    }
    for (const handler of set) {
      handler(message);
    }
  }

  /** Ferme la socket et purge l'état (appelé au dernier unsubscribe). */
  close(): void {
    if (this.socket !== null) {
      this.socket.close();
      this.socket = null;
    }
    this.open = false;
    this.pending = [];
    this.handlers.clear();
  }
}
