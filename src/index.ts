// ── Surface publique du SDK Lighter ───────────────────────────────────────────
// Point d'entrée unique : la classe `Lighter`. Tout le reste (fonctions REST, client WS brut,
// signer WASM, types natifs) est interne et n'est pas exporté.

/** Façade : `new Lighter(signers, { default })` puis `.perp()/.account()/.ws()/.apiKeys()/…`. */
export { Lighter, type LighterDexOptions } from './dex/lighter';

/** Surcharge l'emplacement du signer WASM (sinon résolu près du module / cwd / node_modules). */
export { setWasmDir } from './rest/wasm-signer';

/** Contrat commun aux DEX : interfaces de capacités + types d'entrée (Input) des méthodes. */
export type * from './dex/contract';

/** Interfaces **complémentaires** Lighter (apiKeys / subAccounts / transfers). */
export type * from './dex/native-contract';

/** Configuration d'un signer (passé au constructeur) et réseau. */
export type { Signer, Network } from './common/types';

/** Types **de sortie** unifiés renvoyés par les méthodes de la façade. */
export type {
  Balance,
  Candle,
  FundingRate,
  MarketKind,
  Order,
  OrderBook,
  OrderBookLevel,
  Pair,
  Position,
  Price,
  Side,
  SubAccount,
  Trade,
  UserTrade,
} from './common/types';

/** Unsubscribe : valeur de retour des souscriptions WS. */
export type { Unsubscribe } from './common/ws';
