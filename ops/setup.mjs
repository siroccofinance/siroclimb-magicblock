// One-time devnet setup (idempotent): test-USDC mint (authority = config PDA),
// house vault (token account owned by config), config, house bankroll, round
// slots. Writes js/chain/deployment.js for the front and the scripts.
import fs from 'fs';
import { Keypair, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { PROGRAM_ID, ROUND_SLOTS, TOKEN_PROGRAM_ID, USDC_DECIMALS } from '../js/chain/config.js';
import { configPda, roundSlotPda } from '../js/chain/pdas.js';
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
const vaultBal = await conn.getTokenAccountBalance(vaultKey);
const want = Number(process.env.HOUSE_BANKROLL || 5_000_000);
if (Number(vaultBal.value.uiAmount) < want / 2) {
  const sig = await send(conn, [ix2.fundHouse(admin.publicKey, BigInt(want) * 1_000_000n, mintKey, vaultKey)], [admin], { label: 'fund house' });
  console.log('house funded with', want, 'tUSDC', sig);
}
for (let slot = 0; slot < ROUND_SLOTS; slot++) {
  if (await conn.getAccountInfo(roundSlotPda(slot))) continue;
  const sig = await send(conn, [ix2.initRoundSlot(admin.publicKey, slot)], [admin], { label: `round slot ${slot}` });
  console.log('round slot', slot, roundSlotPda(slot).toBase58(), sig);
}
// GBP/USD relay account, delegated to the rollup, pushed by the relay key.
const { relayPda } = await import('../js/chain/pdas.js');
const { MARKETS, RELAY_ASSET, ER_VALIDATOR } = await import('../js/chain/config.js');
const relayer = namedKeypair('relayer');
if (!(await conn.getAccountInfo(relayPda(RELAY_ASSET)))) {
  const sig = await send(conn, [ix2.initRelay(admin.publicKey, RELAY_ASSET, MARKETS[RELAY_ASSET].exponent, relayer.publicKey), ix2.delegateRelay(admin.publicKey, RELAY_ASSET, ER_VALIDATOR)], [admin], { label: 'relay' });
  console.log('relay', relayPda(RELAY_ASSET).toBase58(), 'relayer', relayer.publicKey.toBase58(), sig);
}
console.log('setup done');
