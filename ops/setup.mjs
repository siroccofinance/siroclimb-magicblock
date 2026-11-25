// One-time devnet setup (idempotent): test-USDC mint (authority = config PDA),
// house vault (token account owned by config), config, the bankroll and the
// Sirocco Reserve opened on it (the deployer is its first lender).
// Writes js/chain/deployment.js for the front and the scripts.
// NOTE: the one-time setup instructions (initialize, init_reserve, init_relay, delegate_relay, init_desk,
// set_desk, fund_house, close_round_slot) ran on devnet and were removed from the program on 25 Nov 2026
// to keep its binary small. A new deployment needs the program built from commit 13a9760 for its setup.
import fs from 'fs';
import { Keypair, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { PROGRAM_ID, TOKEN_PROGRAM_ID, USDC_DECIMALS } from '../js/chain/config.js';
import { configPda } from '../js/chain/pdas.js';
import { ix } from '../js/chain/ix.js';
import { decodeConfig } from '../js/chain/codec.js';
import { send } from '../js/chain/tx.js';
import { adminKeypair, baseConnection, namedKeypair } from './lib/env.mjs';

const conn = baseConnection();
const admin = adminKeypair();
const config = configPda();

const initMint = (mint, authority) => {
  const d = Buffer.alloc(67); d[0] = 0; d[1] = USDC_DECIMALS; authority.toBuffer().copy(d, 2); d[34] = 0; // no freeze authority
  return new TransactionInstruction({ programId: TOKEN_PROGRAM_ID, keys: [{ pubkey: mint, isSigner: false, isWritable: true }, { pubkey: new (admin.publicKey.constructor)('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }], data: d });
};
const initAccount = (acc, mint, owner) => {
  const d = Buffer.alloc(33); d[0] = 18; owner.toBuffer().copy(d, 1); // InitializeAccount3
  return new TransactionInstruction({ programId: TOKEN_PROGRAM_ID, keys: [{ pubkey: acc, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false }], data: d });
};

let existing = await conn.getAccountInfo(config);
let mintKey, vaultKey;
if (!existing) {
  const mint = namedKeypair(`usdc-mint-${PROGRAM_ID.toBase58().slice(0, 8)}`);
  const vault = namedKeypair(`vault-${PROGRAM_ID.toBase58().slice(0, 8)}`);
  const rentMint = await conn.getMinimumBalanceForRentExemption(82);
  const rentAcc = await conn.getMinimumBalanceForRentExemption(165);
  const ixs = [];
  if (!(await conn.getAccountInfo(mint.publicKey))) {
    ixs.push(SystemProgram.createAccount({ fromPubkey: admin.publicKey, newAccountPubkey: mint.publicKey, lamports: rentMint, space: 82, programId: TOKEN_PROGRAM_ID }));
    ixs.push(initMint(mint.publicKey, config));
  }
  if (!(await conn.getAccountInfo(vault.publicKey))) {
    ixs.push(SystemProgram.createAccount({ fromPubkey: admin.publicKey, newAccountPubkey: vault.publicKey, lamports: rentAcc, space: 165, programId: TOKEN_PROGRAM_ID }));
    ixs.push(initAccount(vault.publicKey, mint.publicKey, config));
  }
  ixs.push(ix.initialize(admin.publicKey, mint.publicKey, vault.publicKey));
  const sig = await send(conn, ixs, [admin, mint, vault], { label: 'initialize' });
  console.log('initialized', sig);
  existing = await conn.getAccountInfo(config);
}
const c = decodeConfig(existing.data);
mintKey = c.usdcMint; vaultKey = c.vault;
fs.writeFileSync(new URL('../js/chain/deployment.js', import.meta.url), `// Written by \`npm run setup\` (ops/setup.mjs): the devnet deployment the front talks to.
export default {
  programId: '${PROGRAM_ID.toBase58()}',
  usdcMint: '${mintKey.toBase58()}',
  vault: '${vaultKey.toBase58()}',
};
`);
console.log('config', config.toBase58(), 'mint', mintKey.toBase58(), 'vault', vaultKey.toBase58());

// Reload the modules with the deployment written.
const { ix: ix2 } = await import('../js/chain/ix.js?with-deployment');
const { reservePda } = await import('../js/chain/pdas.js');
if (!(await conn.getAccountInfo(reservePda()))) {
  // the bankroll is minted to the vault, then the reserve opens on it: the
  // deployer's lender position (after this, minting would be a gift to lenders)
  const vaultBal = await conn.getTokenAccountBalance(vaultKey);
  const want = Number(process.env.HOUSE_BANKROLL || 5_000_000);
  if (Number(vaultBal.value.uiAmount) < want / 2) {
    const sig = await send(conn, [ix2.fundHouse(admin.publicKey, BigInt(want) * 1_000_000n, mintKey, vaultKey)], [admin], { label: 'fund house' });
    console.log('bankroll minted:', want, 'tUSDC', sig);
  }
  const sig = await send(conn, [ix2.initReserve(admin.publicKey, vaultKey)], [admin], { label: 'open reserve' });
  console.log('Sirocco Reserve', reservePda().toBase58(), 'opened, the deployer is its first lender', sig);
}
// xStock relay accounts (TSLAx, NVDAx, AAPLx), delegated to the rollup, pushed by the relay key.
{
  const { relayPda } = await import('../js/chain/pdas.js');
  const { MARKETS, RELAY_ASSETS, ER_VALIDATOR } = await import('../js/chain/config.js');
  const relayer = namedKeypair('relayer');
  for (const a of RELAY_ASSETS) {
    if (await conn.getAccountInfo(relayPda(a))) continue;
    const sig = await send(conn, [ix2.initRelay(admin.publicKey, a, MARKETS[a].exponent, relayer.publicKey), ix2.delegateRelay(admin.publicKey, a, ER_VALIDATOR)], [admin], { label: `relay ${MARKETS[a].id}` });
    console.log('relay', MARKETS[a].id, relayPda(a).toBase58(), 'relayer', relayer.publicKey.toBase58(), sig);
  }
}
console.log('setup done');
