import type { LighterClient } from '../common/config';
import type { SendTxResult } from './send-tx';
import { signAndSend } from './signing';

/** Paramètres **natifs** d'un ordre (entiers scalés par la façade selon les décimales du marché). */
export interface PlaceOrderNative {
  marketIndex: number;
  /** Client order index (entier, `0` = aucun). */
  clientOrderIndex: number;
  /** Quantité de base en unités natives (`size * 10^size_decimals`). */
  baseAmount: number;
  /** Prix en unités natives (`price * 10^price_decimals`). */
  price: number;
  /** `1` = vente (ask), `0` = achat (bid). */
  isAsk: number;
  /** Type d'ordre natif (cf. `ORDER_TYPE`). */
  orderType: number;
  /** Time-in-force natif (cf. `TIF`). */
  timeInForce: number;
  /** `1` = reduce-only. */
  reduceOnly: number;
  /** Prix de déclenchement natif (`0` si aucun). */
  triggerPrice: number;
  /** Expiration (ms) ; `0` pour IOC/market, `-1` ⇒ +28 j côté WASM. */
  orderExpiry: number;
}

/** Signe et envoie un ordre (`SignCreateOrder` → `/sendTx`). */
export function placeOrder(
  client: LighterClient,
  label: string | undefined,
  order: PlaceOrderNative,
): Promise<SendTxResult> {
  return signAndSend(client, label, (signer) =>
    signer.wasm.signCreateOrder({
      ...order,
      nonce: signer.nonce,
      apiKeyIndex: signer.apiKeyIndex,
      accountIndex: signer.accountIndex,
    }),
  );
}
