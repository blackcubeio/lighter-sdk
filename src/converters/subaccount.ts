import type { SubAccount } from '../common/types';

/** Item natif d'un compte/sous-compte (`/accountsByL1Address`, `/account`). */
export interface NativeAccountRef {
  account_index?: number;
  index?: number;
  l1_address?: string;
  [extra: string]: unknown;
}

const KNOWN = ['l1_address'];

/**
 * Convertisseur sous-compte Lighter (`/accountsByL1Address`) → {@link SubAccount} unifié.
 * `address` = adresse L1 si fournie, sinon l'index du compte. Le reste part dans `xtras`.
 * Unidirectionnel.
 */
export class SubAccountConverter {
  toCommon(raw: NativeAccountRef): SubAccount {
    const index = raw.account_index ?? raw.index;
    const xtras: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!KNOWN.includes(key)) {
        xtras[key] = value;
      }
    }
    return {
      address: raw.l1_address ?? (index !== undefined ? String(index) : ''),
      xtras: Object.keys(xtras).length > 0 ? xtras : undefined,
    };
  }
}
