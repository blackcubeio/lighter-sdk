import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Signer } from '../src/common/types';
import { Lighter } from '../src/dex/lighter';

// Trading **réel sur testnet** (politique : écritures sur testnet uniquement, jamais de mock,
// jamais de création de clé API ici). Les creds testnet financées sont dans `.env`
// (`WALLET_LIGHTER_SUB04_*` = clé API index 4 ; `EVM_PUBLIC_KEY` = adresse L1). L'`accountIndex`
// est résolu depuis l'adresse L1 (compte main). Suite ignorée si `.env`/creds absents.

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const apiPrivateKey = process.env.WALLET_LIGHTER_SUB04_PRIVATE_KEY;
const l1Address = process.env.EVM_PUBLIC_KEY;
const apiKeyIndex = Number(process.env.LIGHTER_TESTNET_API_KEY_INDEX ?? '4');
const ready = apiPrivateKey !== undefined && l1Address !== undefined;

describe.skipIf(!ready)('Lighter — trading testnet réel (compte main)', () => {
  let dex: Lighter;

  beforeAll(async () => {
    // Résout l'index du compte main (account_type 0) depuis l'adresse L1.
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
    console.log('compte testnet:', main.index, 'apiKeyIndex:', apiKeyIndex);
  });

  it('lit les soldes (tous les actifs spot, public par index)', async () => {
    const balances = await dex.account().getBalances();
    console.log('soldes:', JSON.stringify(balances.map((b) => ({ a: b.asset, t: b.total }))));
    const usdc = balances.find((b) => b.asset === 'USDC');
    expect(usdc).toBeDefined();
    expect(Number(usdc?.total)).toBeGreaterThan(0); // collatéral perp dans margin_balance
    expect(balances.length).toBeGreaterThan(1); // ETH, LIT, USDC… (les actifs spot sont exposés)
  });

  it('place un ordre limite loin du marché, le lit, puis annule tout', async () => {
    // Le carnet testnet est souvent vide : on prend le prix de référence via getPrices (last).
    const prices = await dex.perp().getPrices();
    const ref = Number(prices.find((p) => p.name === 'BTC')?.last ?? 0);
    expect(ref).toBeGreaterThan(0);
    const farPrice = (ref * 0.5).toFixed(1); // 50 % sous le marché → ne s'exécute pas

    const order = await dex.perp().placeOrder({
      name: 'BTC',
      side: 'buy',
      type: 'limit',
      size: '0.001',
      price: farPrice,
      tif: 'gtc',
      clientId: String(Date.now() % 1_000_000),
    });
    console.log('ordre placé:', JSON.stringify(order));
    expect(order.name).toBe('BTC');
    expect(order.status).toBe('open');

    await new Promise((r) => setTimeout(r, 2000));
    const open = await dex.perp().getOpenOrders({ name: 'BTC' });
    console.log('ordres ouverts BTC:', open.length, JSON.stringify(open[0] ?? null));

    const cancelled = await dex.perp().cancelAllOrders({ name: 'BTC' });
    console.log('cancelAll:', JSON.stringify(cancelled));

    await new Promise((r) => setTimeout(r, 2000));
    const after = await dex.perp().getOpenOrders({ name: 'BTC' });
    console.log('ordres ouverts BTC après annulation:', after.length);
  });
});
