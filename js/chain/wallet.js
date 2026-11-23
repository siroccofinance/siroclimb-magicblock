// Browser wallets: injected Solana wallets (Phantom, Solflare, Backpack) and a
// built-in burner for zero-install devnet play. A burner is a keypair kept in
// this browser's localStorage: devnet only, never anything of value.
import { Keypair } from '@solana/web3.js';

const BURNER = 'siroclimb:burner';

export function injectedWallets() {
  const w = globalThis.window || {};
  const out = [];
  const phantom = (w.phantom && w.phantom.solana) || (w.solana && w.solana.isPhantom ? w.solana : null);
  if (phantom) out.push({ id: 'phantom', name: 'Phantom', provider: phantom });
  if (w.solflare && w.solflare.isSolflare) out.push({ id: 'solflare', name: 'Solflare', provider: w.solflare });
  if (w.backpack && w.backpack.solana) out.push({ id: 'backpack', name: 'Backpack', provider: w.backpack.solana });
  return out;
}

/// `{ publicKey, signTransaction, kind }` for the chosen wallet.
export async function openWallet(id) {
  if (id === 'burner') {
    let raw = localStorage.getItem(BURNER);
    if (!raw) { raw = JSON.stringify(Array.from(Keypair.generate().secretKey)); localStorage.setItem(BURNER, raw); }
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    return { kind: 'burner', name: 'Burner', publicKey: kp.publicKey, keypair: kp, signTransaction: async (tx) => { tx.partialSign(kp); return tx; } };
  }
  const w = injectedWallets().find((x) => x.id === id);
  if (!w) throw new Error('Wallet not found in this browser');
  const res = await w.provider.connect();
  const publicKey = (res && res.publicKey) || w.provider.publicKey;
  return { kind: id, name: w.name, publicKey, provider: w.provider, signTransaction: (tx) => w.provider.signTransaction(tx), disconnect: () => w.provider.disconnect && w.provider.disconnect() };
}

/// The session key for a wallet, kept in localStorage until it expires.
export function loadSession(wallet) {
  try {
    const s = JSON.parse(localStorage.getItem('siroclimb:session:' + wallet.toBase58()) || 'null');
    if (!s || s.validUntil < Date.now() / 1000 + 120) return null;
    return { keypair: Keypair.fromSecretKey(Uint8Array.from(s.secret)), validUntil: s.validUntil };
  } catch { return null; }
}
export function saveSession(wallet, session) {
  localStorage.setItem('siroclimb:session:' + wallet.toBase58(), JSON.stringify({ secret: Array.from(session.keypair.secretKey), validUntil: session.validUntil }));
}
export function dropSession(wallet) { localStorage.removeItem('siroclimb:session:' + wallet.toBase58()); }
