import type { MarketKind, Order } from '../common/types';
import type { TxResult } from '../common/types';
import type { GroupedOrder } from '../dex/native-contract';

/**
 * Convertisseur **lot d'ordres groupés** Lighter (TX 28, `/sendTx`) → {@link Order}[] (type commun,
 * 1 `Order` par leg) — **même normalisation que `placeOrder`/HL `placeBatch`**. Lighter ne renvoie
 * qu'un `txHash` (pas de statuts par leg) : `id` reste vide, `status: 'open'`, `filled: '0'`, dérivés
 * du leg d'entrée (vocabulaire commun). Le `txHash` est conservé dans `xtras` de chaque ordre.
 */
export class GroupedOrderConverter {
  constructor(private readonly kind: MarketKind = 'perp') {}

  toCommon(orders: GroupedOrder[], tx: TxResult, time: number = Date.now()): Order[] {
    return orders.map((o) => ({
      name: o.name,
      kind: this.kind,
      id: '',
      clientId: o.clientId ?? null,
      side: o.side,
      type: o.type,
      price: o.price,
      size: o.size,
      filled: '0',
      status: 'open' as const,
      tif: o.tif ?? null,
      reduceOnly: o.reduceOnly ?? null,
      time,
      xtras: { txHash: tx.txHash },
    }));
  }
}
