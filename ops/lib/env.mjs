// Node-side wiring for the ops scripts: keypairs, connections, logging.
//
// Keypairs live outside the repo, under ~/.config/siroclimb/solana/. The admin
// is Siroclimb's own deployer (deployer.json there): the Solana CLI default
// wallet is never used, and is refused. Nothing here prints a secret.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Connection, Keypair } from '@solana/web3.js';
import { BASE_RPC, ER_RPC } from '../../js/chain/config.js';

export const KEY_DIR = process.env.SIROCLIMB_KEYS || path.join(os.homedir(), '.config', 'siroclimb', 'solana');
fs.mkdirSync(KEY_DIR, { recursive: true });

export const loadKeypair = (file) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, 'utf8'))));
const CLI_DEFAULT = path.join(os.homedir(), '.config', 'solana', 'id.json');
/// Siroclimb's dedicated deployer: program upgrade authority, config admin, and
/// the only key that funds the others.
export function adminKeypair() {
  const file = process.env.SIROCLIMB_DEPLOYER || path.join(KEY_DIR, 'deployer.json');
  if (path.resolve(file) === CLI_DEFAULT) throw new Error('Siroclimb never uses the Solana CLI default wallet: use its own deployer');
  return loadKeypair(file);
}

/// A named keypair under KEY_DIR, created on first use.
export function namedKeypair(name) {
  const file = path.join(KEY_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(Array.from(Keypair.generate().secretKey)), { mode: 0o600 });
  }
  return loadKeypair(file);
}

export const baseConnection = () => new Connection(BASE_RPC, 'confirmed');
export const erConnection = () => new Connection(ER_RPC, 'confirmed');

export const short = (k) => { const s = k.toBase58(); return `${s.slice(0, 4)}…${s.slice(-4)}`; };
