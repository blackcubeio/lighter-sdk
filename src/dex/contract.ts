import type {
  Balance,
  Candle,
  FundingRate,
  Order,
  OrderBook,
  Pair,
  Position,
  Price,
  SubAccount,
  Trade,
  TxResult,
  UserTrade,
} from '../common/types';
import type { Unsubscribe } from '../common/ws';

/**
 * Contrat **commun aux 3 DEX** (Aster / Hyperliquid / Pacifica). Décomposé en interfaces par
 * **capacité** : chaque DEX implémente celles qu'il possède. Ces interfaces sont **identiques**
 * dans les 3 dépôts (copiées) ; on ne les étend que par ajout (jamais de signature divergente).
 *
 * Les types métier (`Candle`, `Order`…) sont les types **unifiés Blackcube** (cœur identique
 * entre SDK). Le `kind` (perp/spot) n'est PAS dans les params : il est porté par le **scope**
 * (`dex.perp()` / `dex.spot()`).
 */

// ── Paramètres (sans `kind` : le scope le porte) ──────────────────────────────

export interface CandlesParams {
  name: string;
  interval: string;
  startTime?: string; // datetime UTC "YYYY-MM-DD HH:MM:SS" (C7)
  endTime?: string; // datetime UTC "YYYY-MM-DD HH:MM:SS" (C7)
  limit?: number;
}
export interface OrderBookParams {
  name: string;
  limit?: number;
}
export interface TradesParams {
  name: string;
  limit?: number;
}
export interface FundingParams {
  name: string;
  startTime?: string; // datetime UTC "YYYY-MM-DD HH:MM:SS" (C7)
  endTime?: string; // datetime UTC "YYYY-MM-DD HH:MM:SS" (C7)
  limit?: number;
}
export interface SymbolParams {
  name: string;
}

export interface PlaceOrderParams {
  name: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market' | 'stop' | 'stopMarket' | 'takeProfit' | 'takeProfitMarket';
  size: string;
  price?: string;
  triggerPrice?: string;
  tif?: 'gtc' | 'ioc' | 'fok' | 'alo';
  reduceOnly?: boolean;
  clientId?: string;
}
export interface CancelOrderParams {
  name: string;
  id?: string;
  clientId?: string;
}
export interface CancelAllParams {
  name: string;
}
export interface EditOrderParams {
  name: string;
  id?: string;
  clientId?: string;
  side: 'buy' | 'sell';
  size: string;
  price?: string;
}
export interface LeverageParams {
  name: string;
  leverage: number;
}
export interface MarginModeParams {
  name: string;
  isolated: boolean;
}
export interface IsolatedMarginParams {
  name: string;
  amount: string;
}
export interface WithdrawParams {
  amount: string;
  address?: string;
  asset?: string;
  [extra: string]: unknown;
}

// ── Capacités MARCHÉ (retournées par perp() / spot()) ─────────────────────────

/** Données de marché publiques (les 3 DEX). */
export interface IMarketData {
  getPairs(): Promise<Pair[]>;
  getCandles(query: CandlesParams): Promise<Candle[]>;
  getOrderBook(query: OrderBookParams): Promise<OrderBook>;
  getPrices(): Promise<Price[]>;
  getFundingHistory(query: FundingParams): Promise<FundingRate[]>;
}

/** Métadonnées de marché du produit (infos d'échange, symboles…). */
export interface IMarketMeta {
  /** Brut volontaire — passe-plat de la réponse native ; pas de forme commune cross-DEX. */
  getExchangeInfo(): Promise<unknown>;
}

/** Historique de trades publics en REST (Aster, Pacifica — pas HL). */
export interface IPublicTrades {
  getTrades(query: TradesParams): Promise<Trade[]>;
}

/** Un take-profit partiel d'une protection (déclenchement + taille ; `price` = borne d'exécution). */
export interface ProtectionTp {
  triggerPrice: string;
  size: string;
  /** Prix limite/borne de l'ordre déclenché (HL l'exige ; Aster l'ignore — conditionnel market). */
  price?: string;
}

/**
 * Entrée `placeProtection` : SL plein + N TPs partiels (reduce-only) sur une position EXISTANTE.
 * `side` = sens de la POSITION (les ordres sont posés au sens OPPOSÉ). Tailles + `price` (borne)
 * fournis par l'appelant — pas de recalcul interne (anti-résidu garanti côté appelant).
 */
export interface PlaceProtectionParams {
  name: string;
  side: 'buy' | 'sell';
  sl: { triggerPrice: string; size: string; price?: string };
  tps: ProtectionTp[];
  clientId?: string;
}

/** Placement/annulation/édition d'ordres + levier (les 3 DEX). */
export interface ITrading {
  /**
   * Place un ordre et renvoie un {@link Order}. **Asymétrie volontaire avec `edit`** : `place` rend
   * l'objet `Order` (cœur unifié) car un nouvel ordre porte une identité métier complète ; selon la
   * venue, certains champs peuvent être indéterminés au moment de l'ack (Lighter `/sendTx` ne rend
   * qu'un `txHash` → `status: 'other'`, `filled: ''`, `txHash` en `xtras` ; lire ensuite pour l'état réel).
   */
  place(input: PlaceOrderParams): Promise<Order>;
  cancel(input: CancelOrderParams): Promise<void>;
  cancelAll(input: CancelAllParams): Promise<{ cancelled: number | null }>;
  /**
   * Pose SL + N TPs (reduce-only) sur une position EXISTANTE, en un lot. Mécanisme natif par DEX.
   */
  placeProtection(input: PlaceProtectionParams): Promise<Order[]>;
  /**
   * Ouvre une position AVEC sa protection : entrée + SL + N TPs. Atomique quand la venue expose un lot,
   * sinon legs successifs. Le premier `Order` retourné = l'entrée ; `entry.side` = sens de la position,
   * `protection.side` = idem (legs opposés).
   */
  createEntryWithProtection(
    entry: PlaceOrderParams,
    protection: PlaceProtectionParams,
  ): Promise<Order[]>;
  /** Annule la protection (SL/TPs reduce-only) de la paire — à appeler avant de la re-poser. */
  cancelProtection(input: { name: string }): Promise<void>;
  /**
   * Modifie un ordre et renvoie seulement `{ name, id }` (pas un `Order` complet). **Asymétrie
   * volontaire avec `place`** : une édition ne recrée pas d'identité métier et l'ack ne fournit pas
   * un état d'ordre fiable cross-DEX (Lighter : `id` = `txHash` de la modification) ; on n'invente
   * donc aucun champ — lire l'ordre pour son état réel.
   */
  edit(input: EditOrderParams): Promise<{ name: string; id: string }>;
  updateLeverage(input: LeverageParams): Promise<unknown>;
}

/** Mode de marge cross/isolated (les 3 ; HL le traduit en updateLeverage(isCross)). */
export interface IMarginMode {
  setMarginMode(input: MarginModeParams): Promise<void>;
}

/** Ajout de marge isolée (les 3 DEX). */
export interface IIsolatedMargin {
  addIsolatedMargin(input: IsolatedMarginParams): Promise<void>;
}

/** Retrait de marge isolée (Aster, HL — pas Pacifica). */
export interface IRemovableMargin {
  removeIsolatedMargin(input: IsolatedMarginParams): Promise<void>;
}

// ── Compte PAR PRODUIT (retourné par perp() / spot()) ─────────────────────────

/** Lectures de compte liées au produit (perp ou spot), portées par le scope marché. */
export interface IProductAccount {
  getPositions(query?: SymbolParams): Promise<Position[]>;
  getOpens(query?: SymbolParams): Promise<Order[]>;
  getUserTrades(query?: SymbolParams): Promise<UserTrade[]>;
  /** Brut volontaire — passe-plat de la réponse native ; pas de forme commune cross-DEX. */
  getAccountInfo(): Promise<unknown>;
}

/** Historique des ordres du produit (Aster, Pacifica — pas HL). */
export interface IOrderHistory {
  getHistory(query?: SymbolParams): Promise<Order[]>;
}

// ── Capacités COMPTE TRANSVERSE (retournées par account()) ────────────────────

/** Compte transverse (sans notion de produit) : soldes + retrait (les 3 DEX). */
export interface IAccount {
  getBalances(): Promise<Balance[]>;
  /** Retrait signé → {@link TxResult} (hash + enveloppe brute). Forme commune : résultat de TX. */
  withdraw(input: WithdrawParams): Promise<TxResult>;
}

/** Liste des sous-comptes (Aster, Pacifica — pas HL). */
export interface ISubAccounts {
  getSubAccounts(): Promise<SubAccount[]>;
}

/**
 * Paramètres d'un transfert — **narrowé pour Lighter** : la seule route est vers un autre **compte**
 * par index (`to: { account: '<index>' }`, collatéral USDC). Le compilateur refuse les routes
 * inexistantes (`wallet`/`subAccount`) → pas de throw « non supporté » au runtime (#3).
 */
export interface TransferParams {
  to: { account: string };
  amount: string; // chaîne décimale (USDC)
}

/** **LE** domaine pour bouger des fonds. Chaque DEX implémente les combinaisons `from/to` supportées. */
export interface ITransfers {
  transfer(params: TransferParams): Promise<unknown>;
}

/**
 * **Kill-switch / dead-man's switch serveur** : annule TOUS les ordres après `afterMs` ms de
 * silence, à rafraîchir périodiquement (heartbeat). Capacité **non universelle** — seules les
 * venues qui l'offrent côté serveur l'implémentent (HL `scheduleCancel`, Aster `countdownCancelAll`,
 * Lighter `ScheduledCancelAll`). **Pacifica n'a pas de DMS serveur → ne l'implémente pas** (le bot
 * doit alors faire tourner un watchdog externe). Jamais simulé côté client (mourrait avec le process).
 */
export interface IDeadManSwitch {
  /** Arme/rafraîchit l'annulation auto de tous les ordres après `afterMs` ms sans nouvel appel. */
  armCancelAll(afterMs: number): Promise<unknown>;
  /** Désarme le kill-switch. */
  disarm(): Promise<unknown>;
}

// ── SYSTÈME (retourné par system()) : connectivité, ni compte ni marché ───────

/** Connectivité / horloge serveur (les 3 DEX). */
export interface ISystem {
  ping(): Promise<void>;
  getServerTime(): Promise<number>;
}

// ── Capacités TEMPS RÉEL (retournées par ws()) ────────────────────────────────
// Pas de connect/disconnect : lazy-connect au 1er subscribe, auto-close au dernier unsubscribe.

/** Souscriptions temps réel communes aux 3 DEX. */
export interface IRealtime {
  subscribeCandles(query: { name: string; interval: string }, cb: (c: Candle) => void): Unsubscribe;
  subscribeOrderBook(query: { name: string }, cb: (b: OrderBook) => void): Unsubscribe;
  subscribeTrades(query: { name: string }, cb: (t: Trade) => void): Unsubscribe;
  subscribeBbo(query: { name: string }, cb: (b: OrderBook) => void): Unsubscribe;
  subscribePrices(cb: (p: Price[]) => void): Unsubscribe;
  subscribeOrders(cb: (o: Order) => void): Unsubscribe;
  subscribeUserTrades(cb: (t: UserTrade) => void): Unsubscribe;
  /**
   * Bougies 1m de TOUT le marché en UNE souscription (flux de prix agrégé reconstruit par symbole) : close exact,
   * OHLC échantillonné, volume non porté par le flux agrégé → `0`. Évite N souscriptions `@candle` (cap/throttle
   * par connexion + crawl de re-souscription au reconnect). Commune aux DEX (chaque venue son adaptateur).
   */
  subscribeAllCandles(cb: (c: Candle) => void): Unsubscribe;
}

/** Souscription aux positions (Aster, Pacifica — pas HL). */
export interface IRealtimePositions {
  subscribePositions(cb: (p: Position) => void): Unsubscribe;
}
