import type { LighterClient, WebSocketFactory, WebSocketLike } from '../common/config';
import type { JsonValue, Network } from '../common/types';
import type { StreamHandler, Unsubscribe, WsClientOptions } from '../common/ws';
import { SubscriptionBatcher } from './subscription-batcher';

// ── Robustesse WS : constantes communes aux 4 SDK (mêmes noms, mêmes valeurs) ─────────────────
const RECONNECT_BASE_MS = 500; // délai de base
const RECONNECT_FACTOR = 2; // facteur exponentiel
const RECONNECT_CAP_MS = 30_000; // plafond du délai
const RECONNECT_JITTER = 0.2; // ±20 %
const RECONNECT_STABLE_MS = 10_000; // connexion « stable » → reset du compteur
const HEARTBEAT_INTERVAL_MS = 30_000; // ping périodique (`{ type:'ping' }`)
const IDLE_TIMEOUT_MS = 45_000; // aucun message reçu depuis 45 s → reconnect forcé

/** `WebSocket.OPEN` (readyState) — la frame n'est émise que dans cet état. */
const OPEN = 1;

/** Abonnement vivant ré-jouable au reconnect (clé = channel). `extra` porte ex. `auth`. */
interface ActiveSubscription {
  channel: string;
  extra?: Record<string, unknown>;
}

/**
 * Client WebSocket natif Lighter (un endpoint `wss://…/stream`). **Lazy** : la socket s'ouvre au
 * 1er abonnement et se ferme au dernier (ref-counting par channel). Les `send()` émis avant
 * `onopen` sont **bufferisés** puis rejoués. Les messages sont routés par channel : Lighter
 * répond avec un `channel` en forme `order_book:1` qu'on normalise vers la forme d'abonnement
 * `order_book/1`.
 *
 * Robustesse (spec commune 0.7.0) : reconnexion automatique avec backoff exponentiel + jitter + cap,
 * reset du compteur après stabilité, re-subscribe automatique des abonnements vivants, heartbeat
 * (`{ type:'ping' }`) + idle-timeout (détection de socket zombie), parsing JSON défensif. Toute la
 * mécanique est interne : l'API publique (`subscribe`/`Unsubscribe`/`close`) ne change pas.
 */
export class LighterWsClient {
  private readonly url: string;
  private readonly factory: WebSocketFactory;
  private socket: WebSocketLike | null = null;
  private open = false;
  private pending: string[] = [];
  private readonly handlers = new Map<string, Set<StreamHandler>>();
  /** Abonnements vivants ré-jouables (clé = channel) — alimenté dans `subscribe`, purgé à l'unsub. */
  private readonly activeSubscriptions = new Map<string, ActiveSubscription>();
  private readonly batcher: SubscriptionBatcher;
  private readonly heartbeatIntervalMs: number;

  // ── Cycle de vie / robustesse (vocabulaire commun aux 4 SDK) ──
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMessageAt = 0;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;

  /** Callbacks publics optionnels (alignés sur les 3 autres SDK). */
  public onError: ((error: unknown) => void) | null = null;
  public onClose: (() => void) | null = null;
  public onReconnect: (() => void) | null = null;
  public onMessage: ((message: JsonValue) => void) | null = null;

  constructor(client: LighterClient, options: WsClientOptions = {}) {
    const network: Network =
      options.label !== undefined
        ? (client.signers[options.label]?.network ?? 'mainnet')
        : 'mainnet';
    this.url = options.url ?? client.wsUrls[network];
    this.factory = options.webSocket ?? client.webSocket;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
    this.batcher = new SubscriptionBatcher(
      (frame) => this.rawSend(frame),
      (names) => this.buildSubFrame(names),
      (names) => ({ type: 'unsubscribe', channel: names[0] ?? '' }),
      1,
      60,
    );
  }

  /** Construit la frame d'abonnement d'un channel (réinjecte l'`extra`, ex. `auth`). */
  private buildSubFrame(names: string[]): Record<string, unknown> {
    const channel = names[0] ?? '';
    const sub = this.activeSubscriptions.get(channel);
    return { type: 'subscribe', channel, ...(sub?.extra ?? {}) };
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
      this.activeSubscriptions.set(channel, { channel, extra });
      this.ensureOpen();
      this.batcher.subscribe(channel);
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
        this.activeSubscriptions.delete(channel);
        this.batcher.unsubscribe(channel);
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
    this.connect();
  }

  /** Ouvre la socket et câble les handlers. Idempotent tant qu'une socket vit déjà. */
  private connect(): void {
    if (this.socket !== null) {
      return;
    }
    this.shouldReconnect = true;
    const socket = this.factory(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.open = true;
      this.batcher.setOpen(true);
      const buffered = this.pending;
      this.pending = [];
      for (const message of buffered) {
        socket.send(message);
      }
      this.startHeartbeat();
      this.bumpIdle();
      // Reset du compteur de backoff **après** stabilité (pas dès onopen) : une socket qui claque
      // immédiatement ne doit pas boucler à 500 ms sans jamais grimper.
      this.stableTimer = setTimeout(() => {
        this.reconnectAttempts = 0;
        this.stableTimer = null;
      }, RECONNECT_STABLE_MS);
    };
    socket.onmessage = (event) => {
      this.dispatch(event.data);
    };
    socket.onclose = () => {
      this.handleClose();
    };
    socket.onerror = (error) => {
      if (this.onError !== null) {
        this.onError(error);
      }
    };
  }

  /** Fermeture (volontaire ou non) : arrête les timers, purge l'état, replanifie si besoin. */
  private handleClose(): void {
    this.stopHeartbeat();
    this.stopIdleTimer();
    if (this.stableTimer !== null) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    this.open = false;
    this.socket = null;
    this.batcher.setOpen(false);
    this.batcher.reset();
    if (this.onClose !== null) {
      this.onClose();
    }
    if (this.shouldReconnect === true) {
      this.scheduleReconnect();
    }
  }

  /** Replanifie une connexion avec backoff exponentiel + jitter + cap (ré-armé en cas d'échec). */
  private scheduleReconnect(): void {
    if (this.shouldReconnect === false) {
      return;
    }
    if (this.reconnectTimer !== null) {
      return;
    }
    const capped = Math.min(
      RECONNECT_BASE_MS * RECONNECT_FACTOR ** this.reconnectAttempts,
      RECONNECT_CAP_MS,
    );
    const jitter = capped * RECONNECT_JITTER * (2 * Math.random() - 1);
    const delay = Math.max(0, Math.round(capped + jitter));
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      try {
        this.connect();
        this.afterReconnect();
      } catch (error) {
        if (this.onError !== null) {
          this.onError(error);
        }
        this.scheduleReconnect(); // ré-essaie avec le délai suivant (compteur déjà incrémenté)
      }
    }, delay);
  }

  /** Après reconnexion : rejoue tous les abonnements vivants puis notifie. */
  private afterReconnect(): void {
    this.resubscribeAll();
    if (this.onReconnect !== null) {
      this.onReconnect();
    }
  }

  /** Rejoue **tous** les abonnements vivants (via le batcher, frame reconstruite avec `extra`). */
  private resubscribeAll(): void {
    this.batcher.resubscribe(this.activeSubscriptions.keys());
  }

  // ── Heartbeat + idle-timeout ──

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendPing();
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Ping applicatif Lighter : `{ type:'ping' }` (le serveur répond `{ type:'pong' }`). */
  private sendPing(): void {
    this.send({ type: 'ping' });
  }

  /** Réarme l'idle-timeout : sans message reçu depuis `IDLE_TIMEOUT_MS`, on force la reconnexion. */
  private bumpIdle(): void {
    this.lastMessageAt = Date.now();
    this.stopIdleTimer();
    this.idleTimer = setTimeout(() => {
      // Garde défensive : ne forcer la reconnexion que si le silence dépasse réellement le seuil
      // (un timer mal nettoyé ne doit pas couper une socket fraîchement active).
      if (Date.now() - this.lastMessageAt >= IDLE_TIMEOUT_MS) {
        this.forceReconnect();
      }
    }, IDLE_TIMEOUT_MS);
  }

  private stopIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /** Considère la socket morte (zombie) : la ferme → `handleClose` → `scheduleReconnect`. */
  private forceReconnect(): void {
    if (this.socket !== null) {
      this.socket.close(); // déclenche onclose → handleClose → scheduleReconnect
    }
  }

  /**
   * Émission brute (sans throttle) : ping et frames du batcher. N'émet que si la socket est
   * réellement **OPEN** (`readyState === 1`) : une frame différée par le throttle du batcher peut
   * arriver alors que la socket est repassée en CONNECTING/CLOSING (reconnexion, close concurrent) —
   * `WebSocket.send` lèverait alors « Sent before connected ». Dans ce cas on bufferise (rejoué à la
   * prochaine ouverture ; les abonnements vivants sont de toute façon rejoués via `resubscribeAll`).
   */
  private rawSend(message: string): void {
    if (this.open && this.socket !== null && this.socket.readyState === OPEN) {
      this.socket.send(message);
    } else {
      this.pending.push(message);
    }
  }

  private send(payload: Record<string, unknown>): void {
    this.rawSend(JSON.stringify(payload));
  }

  private dispatch(raw: unknown): void {
    this.bumpIdle();
    let message: JsonValue;
    try {
      message = JSON.parse(String(raw)) as JsonValue;
    } catch {
      if (this.onError !== null) {
        this.onError(new Error('WebSocket : message JSON illisible ignoré'));
      }
      return;
    }
    if (this.onMessage !== null) {
      this.onMessage(message);
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

  /** Ferme la socket et purge l'état (appelé au dernier unsubscribe). Désactive la reconnexion. */
  close(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.stopIdleTimer();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.stableTimer !== null) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    this.reconnectAttempts = 0;
    if (this.socket !== null) {
      this.socket.close();
      this.socket = null;
    }
    this.open = false;
    this.pending = [];
    this.handlers.clear();
    this.activeSubscriptions.clear();
    this.batcher.setOpen(false);
    this.batcher.reset();
  }
}
