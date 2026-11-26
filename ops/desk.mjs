// Open and stock the Sirocco desk on devnet (idempotent):
//   - init_desk: spread, the five market tokens (the xStock and XAUt mirrors), the relay key for quotes
//   - the desk's and the stock-lending book's token accounts for each market token, and the desk's tUSDC
//   - inventory: mirror tokens minted by the deployer (their mint authority) to the desk and the lending book
//   - the desk's tUSDC float, minted through the config (fund_desk)
//
//   npm run desk            (keys in ~/.config/siroclimb/solana/)
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { ATA_PROGRAM_ID, DESK_SPREAD_BPS, MARKETS, ONE_USDC, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, USDC_MINT } from '../js/chain/config.js';
import { ata22Of, ataOf, deskPda, lendPda } from '../js/chain/pdas.js';
import { createAtaIdempotent, ix } from '../js/chain/ix.js';
import { decodeDesk } from '../js/chain/codec.js';
import { send } from '../js/chain/tx.js';
import { adminKeypair, baseConnection, namedKeypair } from './lib/env.mjs';

const conn = baseConnection(), admin = adminKeypair(), relayer = namedKeypair('relayer');
// inventory per market, in whole tokens (about half a million dollars each), for the desk and for the lending book
const INVENTORY = { TSLAx: 1_300, NVDAx: 3_300, AAPLx: 1_400, XAUt: 140, GMEx: 18_000 };
const FLOAT = 2_000_000; // tUSDC

function ata22Create(payer, owner, mint) {
  return new TransactionInstruction({
    programId: ATA_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true }, { pubkey: ata22Of(owner, mint), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false }, { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}
function mintTo22(mint, to, authority, amount, decimals) {
  const data = Buffer.alloc(10); data[0] = 14; data.writeBigUInt64LE(BigInt(amount), 1); data[9] = decimals;   // MintToChecked
  return new TransactionInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [{ pubkey: mint, isSigner: false, isWritable: true }, { pubkey: to, isSigner: false, isWritable: true }, { pubkey: authority, isSigner: true, isWritable: false }],
    data,
  });
}
const balance = async (acc) => { const a = await conn.getAccountInfo(acc); return a ? Buffer.from(a.data).readBigUInt64LE(64) : 0n; };

if (!(await conn.getAccountInfo(deskPda()))) {
  const sig = await send(conn, [ix.initDesk(admin.publicKey, DESK_SPREAD_BPS, MARKETS.map((m) => m.mintKey), MARKETS.map((m) => m.decimals), relayer.publicKey)], [admin], { label: 'init desk' });
  console.log('desk', deskPda().toBase58(), 'quotes relay key', relayer.publicKey.toBase58(), sig);
} else {
  const d = decodeDesk((await conn.getAccountInfo(deskPda())).data);
  if (!d.mints.every((m, a) => m.equals(MARKETS[a].mintKey)) || d.spreadBps !== DESK_SPREAD_BPS) {
    console.log('set desk', await send(conn, [ix.setDesk(admin.publicKey, DESK_SPREAD_BPS, MARKETS.map((m) => m.mintKey), MARKETS.map((m) => m.decimals))], [admin], { label: 'set desk' }));
  }
}
for (const m of MARKETS) {
  const want = BigInt(INVENTORY[m.ticker]) * 10n ** BigInt(m.decimals);
  for (const [who, owner] of [['desk', deskPda()], ['lending book', lendPda()]]) {
    const acc = ata22Of(owner, m.mintKey), have = await balance(acc);
    const ixs = [ata22Create(admin.publicKey, owner, m.mintKey)];
    if (have < want) ixs.push(mintTo22(m.mintKey, acc, admin.publicKey, want - have, m.decimals));
    const sig = await send(conn, ixs, [admin], { label: `${m.ticker} ${who}` });
    console.log(m.ticker.padEnd(6), who.padEnd(12), acc.toBase58(), 'inventory', Number(await balance(acc)) / 10 ** m.decimals, sig.slice(0, 12));
  }
}
const deskUsdc = ataOf(deskPda(), USDC_MINT), haveUsdc = await balance(deskUsdc), wantUsdc = BigInt(FLOAT * ONE_USDC);
const ixs = [createAtaIdempotent(admin.publicKey, deskPda(), USDC_MINT)];
if (haveUsdc < wantUsdc) ixs.push(ix.fundDesk(admin.publicKey, wantUsdc - haveUsdc));
console.log('desk tUSDC', deskUsdc.toBase58(), await send(conn, ixs, [admin], { label: 'desk tUSDC' }), Number(await balance(deskUsdc)) / ONE_USDC);
void PublicKey; void TOKEN_PROGRAM_ID;
console.log('desk ready');
