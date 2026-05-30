import type { NativeAccount, NativeAssetBalance } from '../common/native';
import type { Balance } from '../common/types';
import { xtrasOf } from './xtras';

const ASSET_KNOWN = ['symbol', 'balance', 'locked_balance'] as const;

/**
 * Convertisseur soldes Lighter : compte natif (`/account`) → un {@link Balance} **par actif spot**
 * (`assets[]`). Le `total` agrège le solde spot (`balance`) et le collatéral de marge
 * (`margin_balance` — l'USDC y porte l'équité perp) ; `available` retire le `locked_balance`.
 * Repli sur un seul solde USDC (`collateral`) si `assets` est absent.
 */
export class BalanceConverter {
  private asset(a: NativeAssetBalance): Balance {
    const balance = Number(a.balance ?? 0);
    const margin = Number(a.margin_balance ?? 0);
    const locked = Number(a.locked_balance ?? 0);
    return {
      asset: a.symbol,
      total: String(balance + margin),
      available: String(balance - locked + margin),
      usdValue: null,
      xtras: xtrasOf(a, ASSET_KNOWN),
    };
  }

  toCommon(account: NativeAccount): Balance[] {
    if (account.assets !== undefined && account.assets.length > 0) {
      return account.assets.map((a) => this.asset(a));
    }
    return [
      {
        asset: 'USDC',
        total: account.collateral ?? '0',
        available: account.available_balance ?? null,
        usdValue: account.collateral ?? null,
      },
    ];
  }
}
