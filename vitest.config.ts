import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Les tests d'intégration partagent les mêmes comptes testnet réels :
    // exécution séquentielle pour éviter que les read-back de solde/état/ordres
    // soient faussés par des opérations concurrentes. Le signer WASM est lui aussi
    // un singleton de process → pas de parallélisme inter-fichiers.
    fileParallelism: false,
    // Le bootstrap du WASM (instanciation + enregistrement des globals Go) peut
    // prendre quelques secondes au premier appel signé.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
