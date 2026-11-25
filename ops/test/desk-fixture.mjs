// LiteSVM fixture for the Sirocco desk: Token-2022 mints for the five market tokens (at the addresses
// the client uses), the desk's and the lending book's token accounts with inventory, the desk's tUSDC,
// `init_desk`, and Solana quotes pushed by a relay key.
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { DESK_SPREAD_BPS, MARKETS, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, USDC_MINT } from '../../js/chain/config.js';
import { ata22Of, ataOf, deskPda, lendPda } from '../../js/chain/pdas.js';
import { ix } from '../../js/chain/ix.js';

const rent = (n) => BigInt(Math.ceil((n + 128) * 6960));
export function mint22(authority, decimals) {
  const d = Buffer.alloc(82);
  d.writeUInt32LE(1, 0); authority.toBuffer().copy(d, 4); d.writeBigUInt64LE(10n ** 18n, 36); d[44] = decimals; d[45] = 1;
  return d;
}
export function tokenAccount(mint, owner, amount) {
  const d = Buffer.alloc(165);
  mint.toBuffer().copy(d, 0); owner.toBuffer().copy(d, 32); d.writeBigUInt64LE(BigInt(amount), 64); d[108] = 1;
  return d;
}
/// Token-2022 balance of `acc` (0 if missing).
export function bal22(svm, acc) { const a = svm.getAccount(acc); return a ? Buffer.from(a.data).readBigUInt64LE(64) : 0n; }
export function balUsdc(svm, acc) { const a = svm.getAccount(acc); return a ? Buffer.from(a.data).readBigUInt64LE(64) : 0n; }

/// Prices in the relay's raw units for every market, e.g. [38_000_000, 15_000_000, 35_000_000, 3_540_000, 2_700_000].
export const PRICES = [38_000_000n, 15_000_000n, 35_000_000n, 3_540_000n, 2_700_000n];

export function setupDesk(svm, send, admin, { inventory = 10n ** 15n, usdc = 10_000_000_000_000n } = {}) {
  const relayer = Keypair.generate();
  svm.airdrop(relayer.publicKey, BigInt(LAMPORTS_PER_SOL));
  for (const m of MARKETS) {
    svm.setAccount(m.mintKey, { lamports: Number(rent(82)), data: mint22(admin.publicKey, m.decimals), owner: TOKEN_2022_PROGRAM_ID, executable: false });
    svm.setAccount(ata22Of(deskPda(), m.mintKey), { lamports: Number(rent(165)), data: tokenAccount(m.mintKey, deskPda(), inventory), owner: TOKEN_2022_PROGRAM_ID, executable: false });
    svm.setAccount(ata22Of(lendPda(), m.mintKey), { lamports: Number(rent(165)), data: tokenAccount(m.mintKey, lendPda(), inventory), owner: TOKEN_2022_PROGRAM_ID, executable: false });
  }
  svm.setAccount(ataOf(deskPda(), USDC_MINT), { lamports: Number(rent(165)), data: tokenAccount(USDC_MINT, deskPda(), usdc), owner: TOKEN_PROGRAM_ID, executable: false });
  writeDesk(svm, admin.publicKey, relayer.publicKey);
  void send;
  return { relayer, ok: !!svm.getAccount(deskPda()), logs: [] };
}

export function pushQuotes(send, relayer, ts, prices = PRICES) {
  return send([ix.pushQuotes(relayer.publicKey, prices, BigInt(ts))], [relayer]);
}

// ---------------------------------------------------------------- program state
// The deployed program no longer carries its one-time setup instructions (initialize, init_reserve,
// init_desk...: removed after setup to keep the binary small), so the tests write that state directly,
// byte for byte as those instructions did.
import { PublicKey as PK } from '@solana/web3.js';
import { PROGRAM_ID, VAULT } from '../../js/chain/config.js';
import { discriminator } from '../../js/chain/codec.js';
import { configPda, lenderPda, quotesPda, reservePda } from '../../js/chain/pdas.js';

const bumpOf = (seeds) => PK.findProgramAddressSync(seeds, PROGRAM_ID)[1];
const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
const i64 = (v) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(v)); return b; };
const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
const put = (svm, key, name, body) => {
  const data = Buffer.concat([Buffer.from(discriminator(name)), ...body]);
  svm.setAccount(key, { lamports: Number(rent(data.length)), data, owner: PROGRAM_ID, executable: false });
};

/// Config (admin, test-USDC mint, vault), as `initialize` wrote it.
export function writeConfig(svm, admin) {
  put(svm, configPda(), 'Config', [admin.toBuffer(), USDC_MINT.toBuffer(), VAULT.toBuffer(), u64(0), u64(0), u64(0), u64(0), Buffer.from([bumpOf([Buffer.from('config')])])]);
}
/// The reserve opened on `vault` tUSDC, all of it the admin's shares, as `init_reserve` wrote it.
export function writeReserve(svm, admin, vault, createdTs = 0) {
  put(svm, reservePda(), 'Reserve', [u64(vault), u64(0), u64(0), u64(0), u64(0), u64(0), u64(0), u64(0), u64(0), u64(0), u64(0), i64(createdTs), Buffer.from([bumpOf([Buffer.from('reserve')])])]);
  put(svm, lenderPda(admin), 'Lender', [admin.toBuffer(), u64(vault), u64(vault), u64(0), Buffer.from([bumpOf([Buffer.from('lender'), admin.toBuffer()])])]);
}
/// The desk and its Solana quotes, as `init_desk` wrote them.
export function writeDesk(svm, admin, relayer) {
  put(svm, deskPda(), 'Desk', [admin.toBuffer(), u16(DESK_SPREAD_BPS), ...MARKETS.map((m) => m.mintKey.toBuffer()), Buffer.from(MARKETS.map((m) => m.decimals)),
    u64(0), u64(0), u64(0), u64(0), Buffer.from([bumpOf([Buffer.from('desk')])])]);
  put(svm, quotesPda(), 'Quotes', [relayer.toBuffer(), ...MARKETS.map(() => u64(0)), i64(0), u64(0), Buffer.from([bumpOf([Buffer.from('quotes')])])]);
}
