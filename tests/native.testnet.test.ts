import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Signer } from '../src/common/types';
import { Lighter } from '../src/dex/lighter';

// Validation des capacités **signées** du namespace `native` sur **testnet réel** (politique : on
// valide toujours les capacités signées). On exerce le chemin signé non destructeur de
// `native.apiKeys()` (génération locale WASM, nonce, token d'auth) après la migration sous `native`
// + alignement des verbes. Les écritures (create/transfer/pools/staking) ne sont pas exercées ici
// (effets de bord / fonds).
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const apiPrivateKey = process.env.WALLET_LIGHTER_SUB04_PRIVATE_KEY;
const l1Address = process.env.EVM_PUBLIC_KEY;
const apiKeyIndex = Number(process.env.LIGHTER_TESTNET_API_KEY_INDEX ?? '4');
const ready = apiPrivateKey !== undefined && l1Address !== undefined;

describe.skipIf(!ready)('Lighter native — capacités signées (testnet réel)', () => {
  let dex: Lighter;

  beforeAll(async () => {
    const res = await fetch(
      `https://testnet.zklighter.elliot.ai/api/v1/accountsByL1Address?l1_address=${l1Address}`,
    );
    const body = (await res.json()) as {
      sub_accounts?: { index: number; account_type: number }[];
    };
    const main = body.sub_accounts?.find((a) => a.account_type === 0) ?? body.sub_accounts?.[0];
    if (main === undefined) {
      throw new Error('Compte testnet introuvable pour cette adresse L1');
    }
    const signer: Signer = {
      apiPrivateKey: apiPrivateKey as string,
      apiKeyIndex,
      accountIndex: main.index,
      network: 'testnet',
      l1Address,
    };
    dex = new Lighter({ desk: signer }, { default: 'desk' });
  });

  it('native.apiKeys().generate() (WASM local)', async () => {
    const key = await dex.native.apiKeys().generate();
    expect(key.privateKey).toMatch(/^0x[0-9a-f]+/i);
    expect(typeof key.publicKey).toBe('string');
  });

  it('native.apiKeys().nextNonce() (signé)', async () => {
    const nonce = await dex.native.apiKeys().nextNonce();
    console.log('nextNonce:', nonce);
    expect(Number.isInteger(nonce)).toBe(true);
    expect(nonce).toBeGreaterThanOrEqual(0);
  });

  it('native.apiKeys().authToken() (signé)', async () => {
    const token = await dex.native.apiKeys().authToken();
    console.log('authToken len:', token.length);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });
});
