// One player's side of the game, on both layers: onboarding (the one wallet
// approval), solo climbs, packs, and the permissionless follow-ups
// (finish, settle, record) any client can push forward. Used by the front
// (js/api.js), the in-browser practice bots, the keeper and the batteries.
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { DELEGATION_PROGRAM_ID, ER_VALIDATOR, MARKETS, ONE_USDC, PROGRAM_ID, RUN, USDC_MINT, VAULT } from './config.js';
import { RUN_SIZE, decodeLender, decodePrice, decodeProfile, decodeReserve, decodeRun } from './codec.js';
import { approveIx, createAtaIdempotent, createSessionIx, ix } from './ix.js';
import { ataOf, lenderPda, profilePda, reservePda, runPda, sessionTokenPda } from './pdas.js';
import { send, sleep } from './tx.js';

export const SESSION_HOURS = 12;
/// Lamports the wallet gives its session key: base-layer fees and the rent the
/// delegation program takes while a climb is on the rollup (returned after).
export const SESSION_TOP_UP = 50_000_000;
const ALLOWANCE = 10_000_000n * BigInt(ONE_USDC);

export class Climber {
  /// `wallet`: a Keypair, or `{ publicKey, signTransaction }` (browser wallet).
  /// `session`: `{ keypair, validUntil }` once authorised (or null).
  constructor({ base, er, wallet, session = null, log = () => {} }) {
    this.base = base; this.er = er; this.wallet = wallet; this.session = session; this.log = log;
    this.me = wallet.publicKey;
  }

  get hasSession() { return !!(this.session && this.session.validUntil > Date.now() / 1000 + 60); }
  /// The key that signs game actions: the session key, else the wallet itself.
  get actor() { return this.hasSession ? this.session.keypair : this.wallet; }
  get token() { return this.hasSession ? sessionTokenPda(this.session.keypair.publicKey, this.me) : null; }

  // ------------------------------------------------------------- reads
  async profile() { const a = await this.base.getAccountInfo(profilePda(this.me)); return a ? decodeProfile(a.data) : null; }
  async usdc() {
    const a = await this.base.getAccountInfo(ataOf(this.me, USDC_MINT));
    return a ? Number(Buffer.from(a.data).readBigUInt64LE(64)) / ONE_USDC : 0;
  }
  async sol(key = this.me) { return (await this.base.getBalance(key)) / 1e9; }
  /// The run account wherever it lives: on the rollup while delegated, else on Solana.
  async run() {
    const b = await this.base.getAccountInfo(runPda(this.me));
    if (!b) return null;
    if (b.owner.equals(DELEGATION_PROGRAM_ID)) {
      const e = await this.er.getAccountInfo(runPda(this.me));
      return e ? { ...decodeRun(e.data), layer: 'er' } : { ...decodeRun(b.data), layer: 'moving' };
    }
    return { ...decodeRun(b.data), layer: 'base' };
  }

  // -------------------------------------------------- onboarding (1 approval)
  /// Everything the wallet approves once: token account, faucet, profile,
  /// a fresh MagicBlock session key (topped up with SOL) and the session key's
  /// allowance to stake the wallet's test USDC. Every later action is signed
  /// by the session key, with no wallet prompt.
  async onboard({ name, faucet = true, hours = SESSION_HOURS, topUp = SESSION_TOP_UP } = {}) {
    const keypair = Keypair.generate();
    const validUntil = Math.floor(Date.now() / 1000) + hours * 3600;
    const ixs = [createAtaIdempotent(this.me, this.me)];
    if (faucet && (await this.usdc()) < 100) ixs.push(ix.faucet(this.me));
    if (!(await this.base.getAccountInfo(profilePda(this.me)))) ixs.push(ix.initProfile(this.me, name));
    ixs.push(createSessionIx(this.me, keypair.publicKey, validUntil, topUp));
    ixs.push(approveIx(this.me, keypair.publicKey, ALLOWANCE));
    const sig = await send(this.base, ixs, [this.wallet, keypair], { label: 'onboard' });
    this.session = { keypair, validUntil };
    return sig;
  }

  async faucet() { return send(this.base, [createAtaIdempotent(this.me, this.me), ix.faucet(this.me)], [this.wallet], { label: 'faucet' }); }

  /// Top the session key up again from the wallet (one approval) when it runs low.
  async topUpSession(lamports = SESSION_TOP_UP) {
    return send(this.base, [SystemProgram.transfer({ fromPubkey: this.me, toPubkey: this.session.keypair.publicKey, lamports })], [this.wallet], { label: 'top up' });
  }

  // -------------------------------------------------------------- solo
  /// Stake + delegate on Solana (session key), then begin on the rollup at the live price.
  async startRun({ asset, side, stake, usePack = false, crank = true }) {
    const a = this.actor;
    const t0 = Date.now();
    const sideN = side === 'short' || side === 1 ? 1 : 0;
    // a run account from before the Sirocco Reserve is grown in the same transaction
    const old = await this.base.getAccountInfo(runPda(this.me));
    const grow = old && old.owner.equals(PROGRAM_ID) && old.data.length < RUN_SIZE ? [ix.growRun(a.publicKey, this.me)] : [];
    const base = await send(this.base, [
      ...grow,
      ix.startRun(a.publicKey, this.me, { asset, side: sideN, stake: BigInt(Math.round(stake * ONE_USDC)), usePack }, this.token),
      ix.delegateRun(a.publicKey, this.me, ER_VALIDATOR),
    ], [a], { label: 'start run' });
    const tBase = Date.now();
    await this.waitOnEr(runPda(this.me), (d) => decodeRun(d).status === RUN.STAKED);
    const tEr = Date.now();
    const begin = await send(this.er, [ix.beginRun(a.publicKey, this.me, asset, crank)], [a], { label: 'begin run' });
    const run = await this.run();
    return { run, sigs: { base, begin }, ms: { stake: tBase - t0, delegation: tEr - tBase, begin: Date.now() - tEr } };
  }

  async tickRun(asset) { return send(this.er, [ix.tickRun(this.me, asset)], [this.actor], { label: 'tick' }); }
  async cashOut(asset) { return send(this.er, [ix.cashOut(this.actor.publicKey, this.me, asset)], [this.actor], { label: 'cash out' }); }
  /// Permissionless: end someone's busted / expired climb on the rollup.
  async finishRun(player, asset) { return send(this.er, [ix.finishRun(this.actor.publicKey, player, asset)], [this.actor], { label: 'finish run' }); }
  /// Permissionless: pay out a climb that is back on Solana.
  async settleRun(player = this.me) {
    await this.waitOnBase(runPda(player));
    return send(this.base, [ix.settleRun(this.actor.publicKey, player)], [this.actor], { label: 'settle run' });
  }

  // ----------------------------------------------------- Sirocco Reserve
  /// The reserve and the vault balance it is measured against (raw units).
  async reserve() {
    const [a, v] = await Promise.all([this.base.getAccountInfo(reservePda()), this.base.getTokenAccountBalance(VAULT)]);
    return a ? { ...decodeReserve(a.data), vault: Number(v.value.amount) } : null;
  }
  async lender(owner = this.me) {
    const a = await this.base.getAccountInfo(lenderPda(owner));
    return a ? decodeLender(a.data) : null;
  }
  /// Lend `amount` tUSDC to the reserve (session key as the wallet's spender).
  async deposit(amount) {
    return send(this.base, [ix.deposit(this.actor.publicKey, this.me, BigInt(Math.round(amount * ONE_USDC)), this.token)], [this.actor], { label: 'deposit' });
  }
  /// Redeem `shares` (raw) for tUSDC.
  async withdrawShares(shares) {
    return send(this.base, [createAtaIdempotent(this.actor.publicKey, this.me), ix.withdraw(this.actor.publicKey, this.me, BigInt(shares), this.token)], [this.actor], { label: 'withdraw' });
  }

  // -------------------------------------------------------------- packs
  async openPack() { return send(this.base, [ix.openPack(this.actor.publicKey, this.me, this.token)], [this.actor], { label: 'open pack' }); }

  // ------------------------------------------------------------ waiting
  /// Until the delegated account is readable on the rollup (and `ok(data)`).
  async waitOnEr(key, ok = () => true, timeoutMs = 20000) {
    const t = Date.now();
    while (Date.now() - t < timeoutMs) {
      const a = await this.er.getAccountInfo(key).catch(() => null);
      if (a && a.owner.equals(PROGRAM_ID) && ok(a.data)) return a;
      await sleep(120);
    }
    throw new Error('the rollup did not pick the account up in time');
  }
  /// Until the account is back on Solana, owned by the program again.
  async waitOnBase(key, timeoutMs = 30000) {
    const t = Date.now();
    while (Date.now() - t < timeoutMs) {
      const a = await this.base.getAccountInfo(key).catch(() => null);
      if (a && a.owner.equals(PROGRAM_ID)) return a;
      await sleep(400);
    }
    throw new Error('the account did not come back to Solana in time');
  }
}

/// Live price of a market from its feed account on the rollup (USD).
export async function readPrice(er, asset) {
  const a = await er.getAccountInfo(MARKETS[asset].feedKey);
  const f = decodePrice(a.data);
  return { price: f.raw * 10 ** MARKETS[asset].exponent, raw: f.raw, ts: f.ts };
}
export { PublicKey };
