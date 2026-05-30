import { describe, expect, it } from 'vitest';
import { getWasmInstance } from '../src/rest/wasm-signer';

// Validation **déterministe** du signer WASM officiel, **sans aucun envoi réseau** : on récupère
// l'instance WASM du réseau testnet, on génère une clé jetable, on enregistre un client, et on
// signe un ordre avec un nonce explicite (signature purement locale). Aucune clé API n'est créée
// côté exchange, rien n'est envoyé.
describe('Signer WASM (local, aucun envoi)', () => {
  it('instance par réseau : génère une clé, enregistre un client, signe un ordre', async () => {
    const url = 'https://testnet.zklighter.elliot.ai';
    const wasm = await getWasmInstance(url);

    const key = wasm.generateApiKey();
    expect(key.privateKey).toMatch(/^0x/);
    expect(key.publicKey).toMatch(/^0x/);

    wasm.ensureClient({
      url,
      apiPrivateKey: key.privateKey,
      chainId: 300,
      apiKeyIndex: 2,
      accountIndex: 1,
    });

    const tx = wasm.signCreateOrder({
      marketIndex: 1,
      clientOrderIndex: 0,
      baseAmount: 100,
      price: 739694,
      isAsk: 0,
      orderType: 0,
      timeInForce: 1,
      reduceOnly: 0,
      triggerPrice: 0,
      orderExpiry: -1,
      nonce: 0,
      apiKeyIndex: 2,
      accountIndex: 1,
    });
    expect(tx.txType).toBe(14);
    expect(tx.txInfo.length).toBeGreaterThan(10);
    expect(tx.txHash.length).toBeGreaterThan(10);

    // Surplus L2 (pools) : la signature est câblée et la fonction WASM est bien capturée.
    const pool = wasm.signCreatePublicPool({
      operatorFee: 100,
      initialTotalShares: 1000,
      minOperatorShareRate: 100,
      nonce: 1,
      apiKeyIndex: 2,
      accountIndex: 1,
    });
    expect(pool.txType).toBe(10);
    expect(pool.txInfo.length).toBeGreaterThan(10);
  });

  it('deux instances (mainnet + testnet) coexistent et signent indépendamment', async () => {
    const mainnet = await getWasmInstance('https://mainnet.zklighter.elliot.ai');
    const testnet = await getWasmInstance('https://testnet.zklighter.elliot.ai');
    expect(mainnet).not.toBe(testnet); // une instance WASM distincte par réseau

    // Même couple (apiKeyIndex, accountIndex) enregistré sur les DEUX réseaux avec des clés et des
    // chainId différents : si le registre/chainId fuyait entre instances, l'un écraserait l'autre.
    const order = {
      marketIndex: 1,
      clientOrderIndex: 0,
      baseAmount: 100,
      price: 739694,
      isAsk: 0,
      orderType: 0,
      timeInForce: 1,
      reduceOnly: 0,
      triggerPrice: 0,
      orderExpiry: -1,
      nonce: 0,
      apiKeyIndex: 3,
      accountIndex: 7,
    };
    const keyM = mainnet.generateApiKey();
    const keyT = testnet.generateApiKey();
    mainnet.ensureClient({
      url: 'm',
      apiPrivateKey: keyM.privateKey,
      chainId: 304,
      apiKeyIndex: 3,
      accountIndex: 7,
    });
    testnet.ensureClient({
      url: 't',
      apiPrivateKey: keyT.privateKey,
      chainId: 300,
      apiKeyIndex: 3,
      accountIndex: 7,
    });

    const txM = mainnet.signCreateOrder(order);
    const txT = testnet.signCreateOrder(order);
    expect(txM.txInfo.length).toBeGreaterThan(10);
    expect(txT.txInfo.length).toBeGreaterThan(10);
    // Clés + chainId différents → signatures différentes : preuve d'isolation entre instances.
    expect(txM.txInfo).not.toBe(txT.txInfo);
  });
});
