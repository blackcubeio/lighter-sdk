import { describe, expect, it } from 'vitest';
import type { WebSocketFactory, WebSocketLike } from '../src/common/config';
import type { OrderBook } from '../src/common/types';
import { Lighter } from '../src/dex/lighter';

/**
 * Test de **robustesse WS** (mainnet RÉEL, aucun mock réseau) : on injecte une fabrique qui enveloppe
 * le **vrai** `WebSocket` undici et garde un handle sur la dernière socket vivante. On ouvre un flux
 * public (`subscribeOrderBook`), on **coupe brutalement** la socket (`socket.close()`), puis on vérifie
 * que le client **reconnecte** et **rejoue l'abonnement** (les messages reprennent). Non destructif :
 * lectures publiques uniquement, aucune ressource créée.
 */
const sockets: WebSocketLike[] = [];
const trackingFactory: WebSocketFactory = (url) => {
  const real = new globalThis.WebSocket(url) as unknown as WebSocketLike;
  sockets.push(real);
  return real;
};

const lastSocket = (): WebSocketLike => {
  const s = sockets[sockets.length - 1];
  if (s === undefined) {
    throw new Error('aucune socket ouverte');
  }
  return s;
};

describe('Lighter — robustesse WS : reconnect + resubscribe (mainnet réel)', () => {
  it('reconnecte et rejoue l’abonnement après une coupure brutale de la socket', async () => {
    const dex = new Lighter({}, { webSocket: trackingFactory });
    const ws = dex.ws();

    let received = 0;
    const off = ws.subscribeOrderBook({ name: 'BTC' }, (_book: OrderBook) => {
      received += 1;
    });

    // 1) Premier flux : on attend les premiers messages.
    await waitFor(() => received > 0, 12_000, 'aucun message initial reçu');
    const countBeforeCut = received;
    const socketBeforeCut = lastSocket();

    // 2) Coupure brutale de la socket vivante (simule une perte réseau côté transport).
    socketBeforeCut.close();

    // 3) Le client doit ouvrir une NOUVELLE socket (reconnexion via backoff) ...
    await waitFor(() => sockets.length > 1, 15_000, 'pas de reconnexion (nouvelle socket)');

    // 4) ... et les messages doivent REPRENDRE (preuve que l’abonnement a été rejoué).
    const countAfterReconnect = received;
    await waitFor(
      () => received > countAfterReconnect,
      15_000,
      'les messages n’ont pas repris après reconnexion (resubscribe KO)',
    );

    expect(sockets.length).toBeGreaterThan(1);
    expect(received).toBeGreaterThan(countBeforeCut);

    off();
  }, 60_000);
});

function waitFor(predicate: () => boolean, timeoutMs: number, message: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const tick = (): void => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`timeout: ${message}`));
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}
