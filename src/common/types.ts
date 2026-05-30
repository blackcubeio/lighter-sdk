export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

/** Adresse ou clé EVM, préfixée `0x`. */
export type Hex = `0x${string}`;

export type Network = 'mainnet' | 'testnet';

/** Type de marché d'une paire. Lighter n'expose que des perpétuels (`perp`). */
export type MarketKind = 'perp' | 'spot';

/** Côté d'un ordre/trade : achat ou vente. */
export type Side = 'buy' | 'sell';

/**
 * Paire/marché au **format unifié Blackcube** (mêmes champs entre les SDK
 * hyperliquid/pacifica/aster/lighter, calqués sur HL). Prix/quantités = **chaînes décimales**.
 * `xtras` conserve l'objet d'origine hors cœur : rien n'est jeté.
 */
export interface Pair {
  /** Nom/identifiant de la paire (ex. `BTC`, `ETH`). */
  name: string;
  /** Actif de base. */
  base: string;
  /** Actif de cotation. */
  quote: string;
  /** Type de marché (`perp`/`spot`). */
  kind: MarketKind;
  /** Décimales de taille → pas de quantité = `10^-szDecimals`. */
  szDecimals: number;
  /** Levier max (perp uniquement), si fourni. */
  maxLeverage?: number;
  /** Pas de prix, si fourni. */
  tickSize?: string;
  /** Pas de quantité, si fourni. */
  stepSize?: string;
  /** Notionnel minimum d'un ordre, si fourni. */
  minNotional?: string;
  /** État du marché (ex. `TRADING`), si fourni. */
  status?: string;
  /** Champs natifs **hors cœur unifié** (rien n'est jeté). Omis si tout le natif mappe le cœur. */
  xtras?: Record<string, unknown>;
}

/**
 * Bougie OHLCV au **format unifié Blackcube** (clés courtes, cœur identique entre SDK).
 * Prix et volumes sont des **chaînes décimales**. `xtras` porte le natif hors cœur (rien jeté).
 */
export interface Candle {
  /** Open time — début de la bougie (timestamp ms). */
  t: number;
  /** Close time — fin de la bougie (timestamp ms). */
  T: number;
  /** Symbol — symbole/paire. */
  s: string;
  /** Interval — intervalle (ex. `1h`). */
  i: string;
  /** Open — prix d'ouverture. */
  o: string;
  /** Close — prix de clôture. */
  c: string;
  /** High — plus haut. */
  h: string;
  /** Low — plus bas. */
  l: string;
  /** Volume — volume en actif de base. */
  v: string;
  /** Number of trades — nombre de trades. */
  n: number;
  /** Type de marché (`perp`/`spot`). */
  kind: MarketKind;
  /** Quote volume — volume en cotation. `null` si non fourni. */
  qv: string | null;
  /** Taker buy base volume. `null` si non fourni. */
  tbbv: string | null;
  /** Taker buy quote volume. `null` si non fourni. */
  tbqv: string | null;
  /** Reste des champs non standard, propres à l'exchange (rien jeté). Omis si vide. */
  xtras?: Record<string, unknown>;
}

/** Niveau de carnet au **format unifié** (prix + taille ; `n` = nb d'ordres, `null` si non fourni). */
export interface OrderBookLevel {
  /** Prix du niveau (chaîne décimale). */
  price: string;
  /** Taille cumulée au niveau (chaîne décimale). */
  size: string;
  /** Nombre d'ordres au niveau ; `null` si l'exchange ne le fournit pas. */
  n: number | null;
}

/**
 * Carnet d'ordres au **format unifié Blackcube** (cœur identique entre SDK).
 * `bids` décroissants, `asks` croissants. `time` = timestamp ms (`null` si non fourni).
 */
export interface OrderBook {
  /** Paire/symbole (= `Pair.name`). */
  name: string;
  /** Type de marché (`perp`/`spot`). */
  kind: MarketKind;
  /** Niveaux acheteurs (prix décroissant). */
  bids: OrderBookLevel[];
  /** Niveaux vendeurs (prix croissant). */
  asks: OrderBookLevel[];
  /** Timestamp du carnet (ms) ; `null` si non fourni. */
  time: number | null;
  /** Champs natifs hors cœur (rien jeté), omis si vide. */
  xtras?: Record<string, unknown>;
}

/**
 * Exécution (fill) du compte au **format unifié Blackcube** (cœur identique entre SDK).
 * `side` = sens du fill, `maker` = rôle.
 */
export interface UserTrade {
  /** Paire/symbole (= `Pair.name`). */
  name: string;
  /** Type de marché (`perp`/`spot`). */
  kind: MarketKind;
  /** ID du fill/trade. */
  id: string;
  /** ID de l'ordre parent. */
  orderId: string;
  /** Sens. */
  side: Side;
  /** Prix d'exécution. */
  price: string;
  /** Taille exécutée. */
  size: string;
  /** Frais. */
  fee: string;
  /** Actif des frais ; `null` si non fourni. */
  feeAsset: string | null;
  /** PnL réalisé/clôturé ; `null` si non fourni. */
  pnl: string | null;
  /** Rôle maker ; `null` si non fourni. */
  maker: boolean | null;
  /** Timestamp (ms). */
  time: number;
  /** Champs natifs hors cœur (rien jeté), omis si vide. */
  xtras?: Record<string, unknown>;
}

/**
 * Position ouverte au **format unifié Blackcube** (cœur identique entre SDK).
 * Champs nullables si non fournis.
 */
export interface Position {
  /** Paire/symbole (= `Pair.name`). */
  name: string;
  /** Sens : `long`/`short` (`null` si plate). */
  side: 'long' | 'short' | null;
  /** Taille absolue (chaîne décimale, sans signe). */
  size: string;
  /** Prix d'entrée ; `null` si non fourni. */
  entryPrice: string | null;
  /** Mark price ; `null` si non fourni. */
  markPrice: string | null;
  /** PnL non réalisé ; `null` si non fourni. */
  unrealizedPnl: string | null;
  /** Levier ; `null` si non fourni. */
  leverage: number | null;
  /** Prix de liquidation ; `null` si non fourni. */
  liquidationPrice: string | null;
  /** Marge engagée ; `null` si non fournie. */
  margin: string | null;
  /** Champs natifs hors cœur (rien jeté), omis si vide. */
  xtras?: Record<string, unknown>;
}

/**
 * Snapshot de prix d'un marché au **format unifié Blackcube** (cœur identique entre SDK).
 * Chaque exchange remplit ce qu'il fournit ; le reste est `null`.
 */
export interface Price {
  /** Paire/symbole (= `Pair.name`). */
  name: string;
  /** Type de marché (`perp`/`spot`). */
  kind: MarketKind;
  /** Mark price ; `null` si non fourni. */
  mark: string | null;
  /** Oracle/index price ; `null` si non fourni. */
  oracle: string | null;
  /** Mid price ; `null` si non fourni. */
  mid: string | null;
  /** Meilleur bid ; `null` si non fourni. */
  bid: string | null;
  /** Meilleur ask ; `null` si non fourni. */
  ask: string | null;
  /** Dernier prix négocié ; `null` si non fourni. */
  last: string | null;
  /** Funding rate courant ; `null` si non fourni. */
  funding: string | null;
  /** Open interest ; `null` si non fourni. */
  openInterest: string | null;
  /** Volume 24h (notionnel) ; `null` si non fourni. */
  volume24h: string | null;
  /** Prix de clôture de la veille ; `null` si non fourni. */
  prevDayPrice: string | null;
  /** Timestamp (ms) ; `null` si non fourni. */
  time: number | null;
  /** Champs natifs hors cœur (rien jeté), omis si vide. */
  xtras?: Record<string, unknown>;
}

/**
 * Ordre au **format unifié Blackcube** (cœur identique entre SDK). Type-pivot partagé
 * par les lectures (`getOpenOrders`/`getOrderHistory`) et le trading (`placeOrder`…).
 */
export interface Order {
  /** Paire/symbole (= `Pair.name`). */
  name: string;
  /** Type de marché (`perp`/`spot`). */
  kind: MarketKind;
  /** ID d'ordre exchange. */
  id: string;
  /** Client order id ; `null` si absent. */
  clientId: string | null;
  /** Sens. */
  side: Side;
  /** Type d'ordre unifié. */
  type:
    | 'limit'
    | 'market'
    | 'stop'
    | 'stopMarket'
    | 'takeProfit'
    | 'takeProfitMarket'
    | 'trailingStop'
    | 'other';
  /** Prix limite ; `null` si non applicable (marché). */
  price: string | null;
  /** Quantité demandée (chaîne décimale). */
  size: string;
  /** Quantité exécutée. */
  filled: string;
  /** Statut unifié. */
  status: 'open' | 'partiallyFilled' | 'filled' | 'canceled' | 'rejected' | 'expired' | 'other';
  /** Time-in-force unifié ; `null` si non fourni. */
  tif: 'gtc' | 'ioc' | 'fok' | 'alo' | null;
  /** Reduce-only ; `null` si non fourni. */
  reduceOnly: boolean | null;
  /** Timestamp (ms). */
  time: number;
  /** Champs natifs hors cœur (rien jeté), omis si vide. */
  xtras?: Record<string, unknown>;
}

/**
 * Solde d'un actif au **format unifié Blackcube** (cœur identique entre SDK).
 */
export interface Balance {
  /** Actif (ex. `USDC`). */
  asset: string;
  /** Solde total (chaîne décimale). */
  total: string;
  /** Disponible (chaîne décimale) ; `null` si non fourni. */
  available: string | null;
  /** Valeur en USD ; `null` si non fournie. */
  usdValue: string | null;
  /** Champs natifs hors cœur (rien jeté), omis si vide. */
  xtras?: Record<string, unknown>;
}

/**
 * Sous-compte au **format unifié Blackcube** (cœur identique entre SDK).
 * Seule l'`address` est commune ; tout le reste est propre à chaque exchange → `xtras`.
 */
export interface SubAccount {
  /** Adresse du sous-compte (ou du compte principal). */
  address: string;
  /** Champs natifs hors cœur (rien jeté), omis si vide. */
  xtras?: Record<string, unknown>;
}

/**
 * Trade public au **format unifié Blackcube** (cœur identique entre SDK).
 * `side` = direction du **taker** (agresseur).
 */
export interface Trade {
  /** Prix d'exécution (chaîne décimale). */
  price: string;
  /** Taille exécutée (chaîne décimale). */
  size: string;
  /** Direction du taker/agresseur ; `null` si indéterminé. */
  side: Side | null;
  /** Ce record est-il le maker ; `null` si non applicable. */
  maker: boolean | null;
  /** Timestamp (ms). */
  time: number;
  /** ID du trade ; `null` si non fourni. */
  id: number | null;
  /** Champs natifs hors cœur (rien jeté), omis si vide. */
  xtras?: Record<string, unknown>;
}

/**
 * Point d'historique de **taux de funding** au format unifié (cœur identique entre SDK).
 */
export interface FundingRate {
  /** Paire/symbole (= `Pair.name`). */
  name: string;
  /** Taux de funding (chaîne décimale). */
  fundingRate: string;
  /** Timestamp du funding (ms). */
  time: number;
  /** Champs natifs hors cœur (rien jeté), omis si vide. */
  xtras?: Record<string, unknown>;
}

/** Type de clé d'un signer. Lighter signe en L2 (clé API, courbe maison via WASM). */
export type KeyType = 'lighter';

/**
 * Identité de signature **Lighter**. Lighter signe ses transactions L2 avec une **clé API**
 * (courbe maison, dérivée via le signer WASM officiel). Une **clé L1 EVM** n'est nécessaire
 * que pour les transactions exigeant une signature de niveau 1 (changePubKey, transfer).
 *
 * - `apiPrivateKey` : clé privée de l'API key Lighter (hex). Passée au WASM (`CreateClient`).
 * - `apiKeyIndex` : index de l'API key (uint8). 0–1 réservés (web/mobile), 2–254 custom.
 * - `accountIndex` : index du compte L2 Lighter (identifie le compte côté backend).
 * - `l1Address` : adresse L1 (EVM) du compte — pour les lectures par adresse (sous-comptes).
 * - `l1PrivateKey` : clé privée L1 (EVM `0x…`) — requise seulement pour changePubKey / transfer.
 */
export interface Signer {
  apiPrivateKey: string;
  apiKeyIndex: number;
  accountIndex: number;
  network: Network;
  l1Address?: string;
  l1PrivateKey?: string;
}

/** Signer résolu (label + réseau + indices), prêt pour l'usage interne. */
export interface ResolvedSigner {
  label: string;
  keyType: KeyType;
  apiPrivateKey: string;
  apiKeyIndex: number;
  accountIndex: number;
  network: Network;
  l1Address?: string;
  l1PrivateKey?: string;
}

export type QueryValue = string | number | boolean;
export type QueryParams = Record<string, QueryValue | undefined>;

/**
 * Résultat unifié d'une transaction signée Lighter : hash de transaction + enveloppe brute de
 * réponse (rien n'est jeté). Renvoyé par les écritures spécifiques (créer un sous-compte, transfert).
 */
export interface TxResult {
  txHash: string;
  raw: Record<string, unknown>;
}
