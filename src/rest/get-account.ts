import type { LighterClient } from '../common/config';
import type { LighterEnvelope, NativeAccount } from '../common/native';
import type { Balance, Position } from '../common/types';
import { BalanceConverter } from '../converters/balance';
import { PositionConverter } from '../converters/position';
import { httpGet } from './client';

interface AccountEnvelope extends LighterEnvelope {
  accounts?: NativeAccount[];
}

/**
 * Compte détaillé **public** par index (`/account?by=index`). Contient solde, positions et
 * adresse L1. `label` optionnel choisit le réseau (défaut mainnet).
 */
export function fetchAccount(
  client: LighterClient,
  accountIndex: number,
  label?: string,
): Promise<NativeAccount> {
  return httpGet<AccountEnvelope>(
    client,
    '/api/v1/account',
    { by: 'index', value: accountIndex },
    label,
  ).then((env) => {
    const account = env.accounts?.[0];
    if (account === undefined) {
      throw new Error(`Compte introuvable pour l'index ${accountIndex}`);
    }
    return account;
  });
}

/** Compte brut (non unifié), comme `getAccountInfo` des autres SDK. */
export function getAccountInfo(
  client: LighterClient,
  accountIndex: number,
  label?: string,
): Promise<unknown> {
  return fetchAccount(client, accountIndex, label);
}

/** Positions ouvertes au format unifié. */
export function getPositions(
  client: LighterClient,
  accountIndex: number,
  label?: string,
): Promise<Position[]> {
  return fetchAccount(client, accountIndex, label).then((a) =>
    new PositionConverter().toCommonMany(a.positions ?? []),
  );
}

/** Soldes au format unifié (collatéral USDC). */
export function getBalances(
  client: LighterClient,
  accountIndex: number,
  label?: string,
): Promise<Balance[]> {
  return fetchAccount(client, accountIndex, label).then((a) => new BalanceConverter().toCommon(a));
}
