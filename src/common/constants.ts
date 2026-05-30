import type { Network } from './types';

// ── Hôtes Lighter (zk-rollup, orderbook perp) ─────────────────────────────────
export const REST_URL = 'https://mainnet.zklighter.elliot.ai';
export const WS_URL = 'wss://mainnet.zklighter.elliot.ai/stream';

export const TESTNET_REST_URL = 'https://testnet.zklighter.elliot.ai';
export const TESTNET_WS_URL = 'wss://testnet.zklighter.elliot.ai/stream';

/**
 * Chain id L2 Lighter par réseau (cf. `lighter-go/wasm/main.go`). Passé au signer WASM
 * lors de `CreateClient` et utilisé dans la dérivation des signatures.
 */
export const CHAIN_ID: Record<Network, number> = {
  mainnet: 304,
  testnet: 300,
};

/** Index de l'actif USDC (collatéral) côté Lighter — défaut pour withdraw/transfer. */
export const USDC_ASSET_INDEX = 3;

/** 1 USDC en unités natives (les montants USDC du wire sont en micro-USDC). */
export const ONE_USDC = 1_000_000;

/** Types de transaction L2 Lighter (cf. `lighter-go/types/txtypes/constants.go`). */
export const TX_TYPE = {
  CREATE_SUB_ACCOUNT: 9,
  TRANSFER: 12,
  WITHDRAW: 13,
  CREATE_ORDER: 14,
  CANCEL_ORDER: 15,
  CANCEL_ALL_ORDERS: 16,
  MODIFY_ORDER: 17,
  UPDATE_LEVERAGE: 20,
  CREATE_GROUPED_ORDERS: 28,
  UPDATE_MARGIN: 29,
} as const;

/** Types d'ordre natifs Lighter (`LimitOrder = 0`, etc.). */
export const ORDER_TYPE = {
  limit: 0,
  market: 1,
  stopLoss: 2,
  stopLossLimit: 3,
  takeProfit: 4,
  takeProfitLimit: 5,
  twap: 6,
} as const;

/** Time-in-force natif (`ImmediateOrCancel = 0`, `GoodTillTime = 1`, `PostOnly = 2`). */
export const TIF = {
  ioc: 0,
  gtt: 1,
  alo: 2,
} as const;

/** Mode de marge d'une position (`CrossMargin = 0`, `IsolatedMargin = 1`). */
export const MARGIN_MODE = {
  cross: 0,
  isolated: 1,
} as const;

/** Direction d'un ajustement de marge isolée (`Remove = 0`, `Add = 1`). */
export const MARGIN_DIRECTION = {
  remove: 0,
  add: 1,
} as const;

/** Type de route d'un actif (`Perps = 0`, `Spot = 1`). */
export const ROUTE_TYPE = {
  perps: 0,
  spot: 1,
} as const;

/**
 * Mode de `CancelAllOrders` : immédiat, programmé (dead-man's switch armé à une échéance), ou
 * désarmement d'un cancel programmé. (≠ TIF d'un ordre — c'est l'enum natif du tx cancel-all.)
 */
export const CANCEL_ALL_MODE = {
  immediate: 0,
  scheduled: 1,
  abort: 2,
} as const;
