import type { LighterClient } from '../common/config';
import type { Network, TxResult } from '../common/types';
import { LighterApiError, buildUrl } from './client';
import type { WasmTx } from './wasm-signer';

/** Résultat d'un envoi de transaction : hash + enveloppe brute (= {@link TxResult} unifié). */
export type SendTxResult = TxResult;

function postForm(
  client: LighterClient,
  network: Network,
  path: string,
  form: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = buildUrl(client.restUrls[network], path);
  const body = new URLSearchParams(form).toString();
  return client
    .fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    })
    .then((response) =>
      response.text().then((text) => {
        let parsed: Record<string, unknown> | null = null;
        if (text !== '') {
          try {
            parsed = JSON.parse(text) as Record<string, unknown>;
          } catch {
            parsed = null;
          }
        }
        const code = parsed?.code;
        if (response.ok === false || (typeof code === 'number' && code !== 200)) {
          const message =
            (parsed?.message as string | undefined) ??
            (text === '' ? `HTTP ${response.status}` : text);
          throw new LighterApiError(
            response.status,
            typeof code === 'number' ? code : null,
            message,
          );
        }
        return parsed ?? {};
      }),
    );
}

/** Envoie une transaction signée (`/sendTx`, form-urlencoded). */
export function sendTx(
  client: LighterClient,
  tx: WasmTx,
  accountIndex: number,
  apiKeyIndex: number,
  network: Network,
  priceProtection = true,
): Promise<SendTxResult> {
  return postForm(client, network, '/api/v1/sendTx', {
    tx_type: String(tx.txType),
    tx_info: tx.txInfo,
    account_index: String(accountIndex),
    api_key_index: String(apiKeyIndex),
    price_protection: priceProtection ? 'true' : 'false',
  }).then((raw) => ({ txHash: String(raw.tx_hash ?? tx.txHash), raw }));
}

/** Envoie un lot de transactions signées (`/sendTxBatch`). */
export function sendTxBatch(
  client: LighterClient,
  txs: WasmTx[],
  network: Network,
): Promise<SendTxResult> {
  return postForm(client, network, '/api/v1/sendTxBatch', {
    tx_types: JSON.stringify(txs.map((t) => t.txType)),
    tx_infos: JSON.stringify(txs.map((t) => t.txInfo)),
  }).then((raw) => ({ txHash: String(raw.tx_hash ?? ''), raw }));
}
