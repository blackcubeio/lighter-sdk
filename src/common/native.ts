// Types **natifs** Lighter (shapes brutes renvoyées par l'API REST). Internes : seuls les
// converters les lisent ; la façade n'expose que les types unifiés Blackcube (`./types`).
// Tout champ non modélisé reste accessible via index signature et atterrit dans `xtras`.

/** Enveloppe commune : `code` 200 = succès, sinon `message` porte l'erreur. */
export interface LighterEnvelope {
  code: number;
  message?: string;
  [extra: string]: unknown;
}

/** Item de `orderBooks` / `orderBookDetails` (métadonnées d'un marché perp). */
export interface NativeOrderBookMeta {
  symbol: string;
  market_id: number;
  market_type: string;
  status: string;
  taker_fee?: string;
  maker_fee?: string;
  min_base_amount?: string;
  min_quote_amount?: string;
  order_quote_limit?: string;
  supported_size_decimals?: number;
  supported_price_decimals?: number;
  supported_quote_decimals?: number;
  size_decimals?: number;
  price_decimals?: number;
  // Présents seulement sur orderBookDetails :
  last_trade_price?: number;
  daily_trades_count?: number;
  daily_base_token_volume?: number;
  daily_quote_token_volume?: number;
  daily_price_low?: number;
  daily_price_high?: number;
  daily_price_change?: number;
  open_interest?: number;
  default_initial_margin_fraction?: number;
  min_initial_margin_fraction?: number;
  maintenance_margin_fraction?: number;
  [extra: string]: unknown;
}

/**
 * Bougie native Lighter (REST `/candles` **et** flux WS `candle`) — clés courtes. `t` = open time
 * en **millisecondes**, `o/h/l/c` OHLC, `v` volume base, `V` volume quote, `i` dernier trade id.
 */
export interface NativeCandlestick {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  V: number;
  i?: number;
  [extra: string]: unknown;
}

/** Ordre brut d'un côté de carnet (`/orderBookOrders`). Prix/montants en **chaînes décimales**. */
export interface NativeBookOrder {
  order_index?: number;
  order_id?: string;
  owner_account_index?: number;
  initial_base_amount?: string;
  remaining_base_amount: string;
  price: string;
  order_expiry?: number;
  [extra: string]: unknown;
}

/** Ordre de compte (`/accountActiveOrders`, `/accountInactiveOrders`). */
export interface NativeOrder {
  order_index?: number;
  order_id?: string;
  client_order_index?: number;
  client_order_id?: string;
  market_index: number;
  initial_base_amount: string;
  remaining_base_amount?: string;
  filled_base_amount?: string;
  price: string;
  is_ask: boolean;
  type?: string;
  time_in_force?: string;
  reduce_only?: boolean;
  trigger_price?: string;
  status?: string;
  timestamp?: number;
  [extra: string]: unknown;
}

/** Position ouverte (champ `positions` de `/account`). */
export interface NativePosition {
  market_id: number;
  symbol: string;
  initial_margin_fraction?: string;
  sign?: number;
  position: string;
  avg_entry_price?: string;
  position_value?: string;
  unrealized_pnl?: string;
  realized_pnl?: string;
  liquidation_price?: string;
  margin_mode?: number;
  allocated_margin?: string;
  [extra: string]: unknown;
}

/** Solde d'un actif (champ `assets` de `/account`). USDC porte le collatéral perp dans `margin_balance`. */
export interface NativeAssetBalance {
  symbol: string;
  asset_id?: number;
  balance: string;
  locked_balance?: string;
  margin_balance?: string;
  margin_mode?: string;
  [extra: string]: unknown;
}

/** Compte détaillé (`/account?by=index`). */
export interface NativeAccount {
  account_index: number;
  l1_address?: string;
  collateral?: string;
  available_balance?: string;
  positions?: NativePosition[];
  assets?: NativeAssetBalance[];
  [extra: string]: unknown;
}

/** Trade public natif (`/recentTrades`, `/trades`). Prix/taille en **chaînes décimales**. */
export interface NativeTrade {
  trade_id?: number;
  trade_id_str?: string;
  market_id: number;
  size: string;
  price: string;
  usd_amount?: string;
  is_maker_ask?: boolean;
  timestamp: number;
  [extra: string]: unknown;
}

/** Point de funding natif (`/fundings`). `timestamp` en **secondes**, `rate` décimal. */
export interface NativeFunding {
  timestamp: number;
  value: string;
  rate: string;
  direction?: 'long' | 'short';
  [extra: string]: unknown;
}

/** Taux de funding **courant** natif (`/funding-rates`). `rate` décimal, par exchange de référence. */
export interface NativeFundingRate {
  market_id: number;
  exchange: string;
  symbol: string;
  rate: number;
  [extra: string]: unknown;
}

/** Liquidation native (`/liquidations`). `executed_at` en **millisecondes**. */
export interface NativeLiquidation {
  id?: number;
  market_id: number;
  type?: string;
  trade?: {
    price?: string;
    size?: string;
    taker_fee?: string;
    maker_fee?: string;
    transaction_time?: number;
    [extra: string]: unknown;
  };
  info?: Record<string, unknown>;
  executed_at?: number;
  [extra: string]: unknown;
}

/** Paiement de funding par position natif (`/positionFunding`). `timestamp` en **millisecondes**. */
export interface NativePositionFunding {
  timestamp: number;
  market_id: number;
  funding_id?: number;
  change?: string;
  discount?: string;
  rate?: string;
  position_size?: string;
  position_side?: 'long' | 'short';
  [extra: string]: unknown;
}

/** Point de courbe de PnL natif (`/pnl`). `timestamp` en **millisecondes**, montants décimaux. */
export interface NativePnlEntry {
  timestamp: number;
  trade_pnl?: number;
  pool_pnl?: number;
  staking_pnl?: number;
  trade_spot_pnl?: number;
  inflow?: number;
  outflow?: number;
  volume?: number;
  [extra: string]: unknown;
}
