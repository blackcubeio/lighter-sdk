import type { NativeBookOrder } from '../common/native';
import type { MarketKind, OrderBook, OrderBookLevel } from '../common/types';

/** Réponse native `/orderBookOrders` (liste d'ordres bruts par côté). */
export interface NativeOrderBook {
  asks?: NativeBookOrder[];
  bids?: NativeBookOrder[];
}

/**
 * Convertisseur carnet Lighter (`/orderBookOrders`) → {@link OrderBook} unifié. Lighter renvoie
 * des **ordres individuels** (un par ligne) ; on cumule `remaining_base_amount` par prix et on
 * compte le nombre d'ordres au niveau. `bids` décroissants, `asks` croissants. `name` porté par
 * le constructeur. Unidirectionnel.
 */
export class OrderBookConverter {
  constructor(
    private readonly name: string,
    private readonly kind: MarketKind = 'perp',
  ) {}

  private levels(orders: NativeBookOrder[], descending: boolean): OrderBookLevel[] {
    const byPrice = new Map<string, { size: number; n: number }>();
    for (const order of orders) {
      const size = Number(order.remaining_base_amount);
      const acc = byPrice.get(order.price);
      if (acc === undefined) {
        byPrice.set(order.price, { size, n: 1 });
      } else {
        acc.size += size;
        acc.n += 1;
      }
    }
    const out = [...byPrice.entries()].map(([price, { size, n }]) => ({
      price,
      size: String(size),
      n,
    }));
    out.sort((a, b) =>
      descending ? Number(b.price) - Number(a.price) : Number(a.price) - Number(b.price),
    );
    return out;
  }

  toCommon(raw: NativeOrderBook): OrderBook {
    return {
      name: this.name,
      kind: this.kind,
      bids: this.levels(raw.bids ?? [], true),
      asks: this.levels(raw.asks ?? [], false),
      time: null,
    };
  }
}
