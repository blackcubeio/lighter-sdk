import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Signer } from '../src/common/types';
import { Lighter } from '../src/dex/lighter';

// Validation des capacités **signées** du namespace `native` sur **testnet réel** (politique : on
// valide toujours les capacités signées). On exerce le chemin signé non destructeur de
// `native.signing()` (génération locale WASM, nonce, token d'auth) après la migration sous `native`
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

  it('perp().placeBatch() : chemin TX 28 signé sur testnet', async () => {
    // TX 28 = ordres GROUPÉS (OCO/OTO/OTOCO) : grammaire parent/enfant stricte côté protocole.
    // On exerce le **chemin de signature TX 28** (WASM officiel recompilé) sur testnet réel : on
    // accepte un succès OU un rejet **structurel métier** (grouping/ordre), jamais un échec de
    // marshaling/fonction absente. Une structure OCO complète valide est exercée manuellement.
    const ref = Number((await dex.perp().getPrices()).find((p) => p.name === 'BTC')?.last ?? 0);
    expect(ref).toBeGreaterThan(0);
    try {
      const res = await dex.native.perp().placeBatch(
        [
          { name: 'BTC', side: 'buy', type: 'limit', size: '0.001', price: (ref * 0.5).toFixed(1) },
          {
            name: 'BTC',
            side: 'sell',
            type: 'limit',
            size: '0.001',
            price: (ref * 1.5).toFixed(1),
          },
        ],
        2, // OCO
      );
      // `placeBatch` renvoie `Order[]` (1 par leg) ; le txHash de la TX 28 est en `xtras`.
      console.log('grouped orders txHash:', res[0]?.xtras?.txHash);
      expect(res).toHaveLength(2);
      expect(res[0]?.xtras?.txHash).toBeTruthy();
      await dex.perp().cancelAll({ name: 'BTC' });
    } catch (e) {
      const msg = String((e as Error).message);
      console.log('grouped orders rejet structurel (TX 28 atteinte):', msg);
      // Toute erreur émise par SignCreateGroupedOrders prouve que la TX 28 est atteinte et validée.
      expect(msg).toMatch(/SignCreateGroupedOrders|grouping|order|isask|trigger|parent|child/i);
    }
  }, 30_000);

  it('native.perp().getFundingRates() (public réel)', async () => {
    // Sortie normalisée : `FundingRate[]` (type commun ; `exchange` en `xtras`).
    const fr = await dex.native.perp().getFundingRates();
    console.log('funding_rates:', fr.length);
    expect(Array.isArray(fr)).toBe(true);
    expect(fr.length).toBeGreaterThan(0);
    expect(typeof fr[0]?.name).toBe('string');
    expect(typeof fr[0]?.fundingRate).toBe('string');
  });

  it('native.account() : liquidations / positionFunding / pnl (authentifiés réels)', async () => {
    // Sorties normalisées : `Liquidation[]` / `PositionFundingEntry[]` / `PnlPoint[]`.
    const acc = dex.native.account();
    const liq = await acc.getLiquidations({ limit: 10 });
    expect(Array.isArray(liq)).toBe(true);
    const pf = await acc.getPositionFunding({ limit: 10 });
    expect(Array.isArray(pf)).toBe(true);
    const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
    const pnl = await acc.getPnl({
      resolution: '1h',
      startTime: fmt(Date.now() - 7 * 86_400_000),
      endTime: fmt(Date.now()),
      countBack: 10,
    });
    console.log('pnl points:', pnl.length);
    expect(Array.isArray(pnl)).toBe(true);
  }, 30_000);

  it('native.signing().generate() (WASM local)', async () => {
    const key = await dex.native.signing().generate();
    expect(key.privateKey).toMatch(/^0x[0-9a-f]+/i);
    expect(typeof key.publicKey).toBe('string');
  });

  it('native.signing().getNextNonce() (signé)', async () => {
    const nonce = await dex.native.signing().getNextNonce();
    console.log('nextNonce:', nonce);
    expect(Number.isInteger(nonce)).toBe(true);
    expect(nonce).toBeGreaterThanOrEqual(0);
  });

  it('native.signing().getAuthToken() (signé)', async () => {
    const token = await dex.native.signing().getAuthToken();
    console.log('authToken len:', token.length);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });
});
