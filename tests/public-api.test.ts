import { describe, expect, it } from 'vitest';
// Importe **uniquement** depuis le barrel `../src` (surface publique du paquet) : ce test garantit
// que chaque symbole présenté comme importable dans la doc est réellement exporté par `src/index.ts`.
import {
  type Balance,
  type Candle,
  type CandlesParams,
  type FundingParams,
  type FundingRate,
  type GroupedOrder,
  type INativeAccount,
  type INativePerp,
  type ISigning,
  Lighter,
  type LighterDexOptions,
  type Liquidation,
  type MarketKind,
  type Network,
  type Order,
  type OrderBook,
  type Pair,
  type PnlParams,
  type PnlPoint,
  type Position,
  type Price,
  type Side,
  type Signer,
  type SubAccount,
  type Trade,
  type TransferParams,
  type TxResult,
  type Unsubscribe,
  type UserTrade,
  setWasmDir,
} from '../src';

describe('Surface publique — symboles runtime exportés', () => {
  it('exporte la classe façade `Lighter` (valeur)', () => {
    expect(typeof Lighter).toBe('function');
    const dex = new Lighter();
    expect(typeof dex.perp).toBe('function');
    expect(typeof dex.native).toBe('object');
  });

  it('exporte `setWasmDir` (fonction libre)', () => {
    expect(typeof setWasmDir).toBe('function');
  });
});

describe('Surface publique — types exportés (exercice de compilation)', () => {
  it('les types documentés sont importables et utilisables', () => {
    // Options de construction + signer.
    const options: LighterDexOptions = { default: 'desk' };
    const signer: Signer = {
      apiPrivateKey: '0x00',
      apiKeyIndex: 4,
      accountIndex: 1,
      network: 'testnet' satisfies Network,
    };
    const dex = new Lighter({ desk: signer }, options);

    // Entrées (Input) communes.
    const candles: CandlesParams = {
      name: 'BTC',
      interval: '1h',
      startTime: '2026-05-25 00:00:00',
      endTime: '2026-06-01 00:00:00',
    };
    const funding: FundingParams = { name: 'BTC', startTime: '2026-05-25 00:00:00' };
    const transfer: TransferParams = { to: { account: '42' }, amount: '10.5' };

    // Entrées (Input) natives.
    const pnl: PnlParams = {
      resolution: '1h',
      startTime: '2026-05-25 00:00:00',
      endTime: '2026-06-01 00:00:00',
    };
    const leg: GroupedOrder = {
      name: 'BTC',
      side: 'buy',
      type: 'limit',
      size: '0.001',
      price: '30000',
    };

    // Capacités natives (interfaces).
    const signing: Pick<ISigning, 'getNextNonce'> | null = null;
    const nativePerp: Pick<INativePerp, 'placeBatch'> | null = null;
    const nativeAccount: Pick<INativeAccount, 'getPnl'> | null = null;

    // Sorties (Output) communes + natives + utilitaires.
    const kind: MarketKind = 'perp';
    const side: Side = 'buy';
    const unsub: Unsubscribe = () => {};
    type Outputs =
      | Balance
      | Candle
      | FundingRate
      | Liquidation
      | Order
      | OrderBook
      | Pair
      | PnlPoint
      | Position
      | Price
      | SubAccount
      | Trade
      | TxResult
      | UserTrade;
    const out: Outputs | null = null;

    expect(dex).toBeInstanceOf(Lighter);
    expect(candles.name).toBe('BTC');
    expect(funding.name).toBe('BTC');
    expect(transfer.to.account).toBe('42');
    expect(pnl.resolution).toBe('1h');
    expect(leg.side).toBe('buy');
    expect(kind).toBe('perp');
    expect(side).toBe('buy');
    expect(typeof unsub).toBe('function');
    expect(signing).toBeNull();
    expect(nativePerp).toBeNull();
    expect(nativeAccount).toBeNull();
    expect(out).toBeNull();
  });
});
