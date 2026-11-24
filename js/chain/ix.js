// Instruction builders for every siroclimb instruction, shared by the front,
// the keeper, the bots and the tests. Each returns a TransactionInstruction:
// the caller decides which layer (Solana or the rollup) and which key signs.
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import {
  ATA_PROGRAM_ID, DELEGATION_PROGRAM_ID, ER_VALIDATOR, MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID, MARKETS, PROGRAM_ID, SESSION_PROGRAM_ID,
  SLOT_HASHES, TOKEN_PROGRAM_ID, USDC_MINT, VAULT, VRF_BASE_QUEUE, VRF_PROGRAM_ID,
} from './config.js';
import { encodeIx, ixAccounts } from './codec.js';
import {
  ataOf, bufferPda, relayPda, configPda, delegationMetadataPda, delegationRecordPda, faucetPda, profilePda, roundPda, roundSlotPda, runPda,
  vrfIdentityPda,
} from './pdas.js';
import * as PDAS from './pdas.js';

const FIXED = {
  system_program: SystemProgram.programId, token_program: TOKEN_PROGRAM_ID, magic_program: MAGIC_PROGRAM_ID, magic_context: MAGIC_CONTEXT_ID,
  delegation_program: DELEGATION_PROGRAM_ID, owner_program: PROGRAM_ID, vrf_program: VRF_PROGRAM_ID, slot_hashes: SLOT_HASHES,
  oracle_queue: VRF_BASE_QUEUE, program_identity: null, config: null,
};

/// Build `name` from its IDL account list. `accs` maps snake_case names to
/// keys; optional accounts left out are passed as the program id (Anchor's None).
export function build(name, accs, args = {}, remaining = []) {
  const keys = ixAccounts(name).map((a) => {
    let k = accs[a.name];
    if (k === undefined) {
      if (a.name === 'config') k = configPda();
      else if (a.name === 'program_identity') k = vrfIdentityPda();
      else if (a.address) k = new PublicKey(a.address);
      else if (FIXED[a.name]) k = FIXED[a.name];
    }
    if (k == null) {
      if (a.optional) return { pubkey: PROGRAM_ID, isSigner: false, isWritable: false };
      throw new Error(`${name}: missing account ${a.name}`);
    }
    return { pubkey: k, isSigner: !!a.signer, isWritable: !!a.writable };
  });
  return new TransactionInstruction({ programId: PROGRAM_ID, keys: [...keys, ...remaining], data: encodeIx(name, args) });
}

const feedOf = (asset) => MARKETS[asset].feedKey;
const mint = () => { if (!USDC_MINT) throw new Error('No deployment: run npm run setup'); return USDC_MINT; };
const validatorMeta = (v = ER_VALIDATOR) => [{ pubkey: v, isSigner: false, isWritable: false }];

export const ix = {
  // ----------------------------------------------------------- Solana (base)
  initialize: (admin, usdcMint, vault) => build('initialize', { admin, usdc_mint: usdcMint, vault }),
  fundHouse: (admin, amount, usdcMint = mint(), vault = VAULT) => build('fund_house', { admin, usdc_mint: usdcMint, vault }, { amount }),
  initRoundSlot: (admin, slot) => build('init_round_slot', { admin, round: roundSlotPda(slot) }, { slot }),
  /// `owner`: whose token account receives the top up (a session key claims for its wallet).
  faucet: (user, owner = user) => build('faucet', { user, claim: faucetPda(user), usdc_mint: mint(), user_usdc: ataOf(owner, mint()) }),
  initProfile: (user, name) => build('init_profile', { user, profile: profilePda(user) }, { name }),
  setName: (user, name) => build('set_name', { user, profile: profilePda(user) }, { name }),

  /// `signer` is the wallet, or a session key with its `sessionToken`.
  startRun: (signer, player, { asset, side, stake, usePack = false }, sessionToken = null) =>
    build('start_run', {
      signer, player, profile: profilePda(player), run: runPda(player), player_usdc: ataOf(player, mint()), vault: VAULT, session_token: sessionToken,
    }, { asset, side, stake, use_pack: usePack }),
  delegateRun: (payer, player, validator) => {
    const run = runPda(player);
    return build('delegate_run', {
      payer, player, run, buffer_run: bufferPda(run), delegation_record_run: delegationRecordPda(run), delegation_metadata_run: delegationMetadataPda(run),
    }, {}, validatorMeta(validator));
  },
  settleRun: (caller, player) =>
    build('settle_run', { caller, run: runPda(player), profile: profilePda(player), player_usdc: ataOf(player, mint()), vault: VAULT }),

  openRound: (payer, id, openMarkets) => build('open_round', { payer, round: roundPda(id) }, { id, open_markets: openMarkets }),
  joinRound: (signer, player, id, side, sessionToken = null) =>
    build('join_round', {
      signer, player, profile: profilePda(player), round: roundPda(id), player_usdc: ataOf(player, mint()), vault: VAULT, session_token: sessionToken,
    }, { id, side }),
  delegateRound: (payer, id, validator) => {
    const round = roundPda(id);
    return build('delegate_round', {
      payer, round, buffer_round: bufferPda(round), delegation_record_round: delegationRecordPda(round), delegation_metadata_round: delegationMetadataPda(round),
    }, { id }, validatorMeta(validator));
  },
  /// `winners`: the 1st / 2nd / 3rd players' wallets (as many as were paid).
  settleRound: (caller, id, winners) =>
    build('settle_round', { caller, round: roundPda(id), vault: VAULT }, { id },
      winners.map((w) => ({ pubkey: ataOf(w, mint()), isSigner: false, isWritable: true }))),
  recordRound: (caller, id, players) =>
    build('record_round', { caller, round: roundPda(id) }, { id },
      players.map((p) => ({ pubkey: profilePda(p), isSigner: false, isWritable: true }))),

  initRelay: (admin, market, exponent, relayer) => build('init_relay', { admin, relay: relayPda(market) }, { market, exponent, relayer }),
  delegateRelay: (admin, market, validator) => {
    const relay = relayPda(market);
    return build('delegate_relay', {
      admin, relay, buffer_relay: bufferPda(relay), delegation_record_relay: delegationRecordPda(relay), delegation_metadata_relay: delegationMetadataPda(relay),
    }, { market }, validatorMeta(validator));
  },

  openPack: (payer, player, sessionToken = null) => build('open_pack', { payer, player, profile: profilePda(player), session_token: sessionToken }),

  // ------------------------------------------------------------ the rollup
  beginRun: (payer, player, asset, crank = true) => build('begin_run', { payer, run: runPda(player), feed: feedOf(asset) }, { crank }),
  tickRun: (player, asset) => build('tick_run', { run: runPda(player), feed: feedOf(asset) }),
  cashOut: (payer, player, asset) => build('cash_out', { payer, run: runPda(player), feed: feedOf(asset) }),
  finishRun: (payer, player, asset) => build('finish_run', { payer, run: runPda(player), feed: feedOf(asset) }),
  pushPrice: (relayer, market, price, publishTs) => build('push_price', { relayer, relay: relayPda(market) }, { price, publish_ts: publishTs }),
  goLive: (payer, id, asset, crank = true) => build('go_live', { payer, round: roundPda(id), feed: feedOf(asset) }, { id, crank }),
  tickRound: (id, asset) => build('tick_round', { round: roundPda(id), feed: feedOf(asset) }),
  cashOutRound: (signer, id, asset) => build('cash_out_round', { signer, round: roundPda(id), feed: feedOf(asset) }, { id }),
  finishRound: (payer, id, asset) => build('finish_round', { payer, round: roundPda(id), feed: feedOf(asset) }, { id }),
};

// ------------------------------------------------------- other programs

/// Create the associated token account if it does not exist (idempotent).
export function createAtaIdempotent(payer, owner, mintKey = mint()) {
  return new TransactionInstruction({
    programId: ATA_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ataOf(owner, mintKey), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mintKey, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

/// SPL `Approve`: let `delegate` (the session key) move up to `amount` of the owner's test USDC.
export function approveIx(owner, delegate, amount, mintKey = mint()) {
  const data = Buffer.alloc(9);
  data[0] = 4;
  data.writeBigUInt64LE(BigInt(amount), 1);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: ataOf(owner, mintKey), isSigner: false, isWritable: true },
      { pubkey: delegate, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/// `create_session_v2` of MagicBlock's session-keys program: the wallet
/// (authority + fee payer) authorises `sessionSigner` to act for it on this
/// program until `validUntil`, and tops the session key up with `lamports`.
export function createSessionIx(authority, sessionSigner, validUntil, lamports) {
  const { sessionTokenPda } = PDAS;
  const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(Math.floor(n))); return b; };
  const data = Buffer.concat([
    Buffer.from('dfe96c0741c2eb26', 'hex'), // sha256("global:create_session_v2")[..8]
    Buffer.from([1, 1]), // top_up: Some(true)
    Buffer.from([1]), i64(validUntil),
    Buffer.from([1]), i64(lamports),
  ]);
  return new TransactionInstruction({
    programId: SESSION_PROGRAM_ID,
    keys: [
      { pubkey: sessionTokenPda(sessionSigner, authority), isSigner: false, isWritable: true },
      { pubkey: sessionSigner, isSigner: true, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}
