#!/usr/bin/env node
// Régénère le signer WASM **officiel** Lighter à partir des sources `lighter-go`.
//
// On ne fait confiance à AUCUN binaire .wasm tiers : on le recompile depuis le dépôt officiel
// `elliottech/lighter-go` (cible `GOOS=js GOARCH=wasm`), et on copie le runtime `wasm_exec.js`
// fourni par le GOROOT installé. Les deux artefacts sont déposés dans `wasm/` (vendorés, commités,
// embarqués dans le package npm via le champ `files`).
//
// Prérequis : Go (toolchain `js/wasm`) + git. Usage : `node scripts/build-wasm.mjs`.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmDir = join(root, 'wasm');
const REPO = 'https://github.com/elliottech/lighter-go.git';

function run(cmd, args, cwd, env) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

function goEnv(key) {
  return execFileSync('go', ['env', key], { encoding: 'utf8' }).trim();
}

const work = mkdtempSync(join(tmpdir(), 'lighter-go-'));
try {
  run('git', ['clone', '--depth', '1', REPO, work]);
  run('go', ['mod', 'vendor'], work);
  run('go', ['build', '-trimpath', '-o', join(work, 'lighter-signer.wasm'), './wasm/'], work, {
    GOOS: 'js',
    GOARCH: 'wasm',
  });

  mkdirSync(wasmDir, { recursive: true });
  cpSync(join(work, 'lighter-signer.wasm'), join(wasmDir, 'lighter-signer.wasm'));

  const goroot = goEnv('GOROOT');
  const candidates = [
    join(goroot, 'lib', 'wasm', 'wasm_exec.js'),
    join(goroot, 'misc', 'wasm', 'wasm_exec.js'),
  ];
  const wasmExec = candidates.find((p) => existsSync(p));
  if (!wasmExec) {
    throw new Error(`wasm_exec.js introuvable dans le GOROOT (${goroot})`);
  }
  cpSync(wasmExec, join(wasmDir, 'wasm_exec.js'));

  console.log(`✅ wasm/ régénéré (go ${goEnv('GOVERSION') || goEnv('version')})`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
