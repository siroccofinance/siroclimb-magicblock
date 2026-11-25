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
import { errorCode, send, sleep } from './tx.js';

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
      // the real position: the stake's worth of the market token, into the climb's escrow (long) or borrowed and sold (short)
      ix.openPosition(a.publicKey, this.me, asset),
      ix.delegateRun(a.publicKey, this.me, ER_VALIDATOR),
    ], [a], { label: 'start run' });
    const tBase = Date.now();
    await this.waitOnEr(runPda(this.me), (d) => decodeRun(d).status === RUN.STAKED);
    const tEr = Date.now();
    // the price must be fresh to begin: a relayed xStock may be a second late, so try again briefly
    let begin = null;
    for (let i = 0; ; i++) {
      try { begin = await send(this.er, [ix.beginRun(a.publicKey, this.me, asset, crank)], [a], { label: 'begin run' }); break; }
      catch (e) { if (errorCode(e) !== 6013 || i >= 5) throw e; await sleep(1200); }
    }
    const run = await this.run();
    return { run, sigs: { base, begin }, ms: { stake: tBase - t0, delegation: tEr - tBase, begin: Date.now() - tEr } };
  }

  async tickRun(asset) { return send(this.er, [ix.tickRun(this.me, asset)], [this.actor], { label: 'tick' }); }
  /// Cash out on the rollup. A copy the rollup dropped is sent again freshly signed (a second cash out cannot
  /// apply: the program refuses it), and an attempt that fails because the climb already ended is a success.
  async cashOut(asset, { onRetry } = {}) {
    let last = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try { return await send(this.er, [ix.cashOut(this.actor.publicKey, this.me, asset)], [this.actor], { label: 'cash out', attempts: 1, tries: 24, expire: false }); }
      catch (e) {
        last = e;
        const r = await this.run().catch(() => null);
        if (r && r.status !== RUN.LIVE && r.status !== RUN.STAKED) return e.sig || null;   // it ended (this cash out, a bust or the bell)
        if (errorCode(e) !== null && errorCode(e) !== 6013) throw e;
        onRetry && onRetry(attempt);
      }
    }
    throw last;
  }
  /// Bring the player's run account back to a state a new climb can start from, whatever was left behind
  /// (a tab closed mid-climb, a cash out that never landed, a begin refused on a stale price). `say(msg)` narrates.
  async recover(say = () => {}) {
    const t0 = Date.now();
    for (;;) {
      const r = await this.run();
      if (!r || r.status === RUN.FREE || r.status === RUN.SETTLED) return r;
      if (Date.now() - t0 > 90000) throw new Error('Your previous climb is still settling, try again in a minute');
      const over = r.status === RUN.CASHED || r.status === RUN.BUSTED || r.status === RUN.EXPIRED;
      if (r.layer === 'base') {
        if (over) { say('Settling your previous climb on Solana…'); await this.settleRun().catch(() => {}); }
        else await sleep(1000);
      } else if (r.layer === 'moving') await sleep(800);                       // between Solana and the rollup
      else if (r.status === RUN.LIVE) {                                         // left running on the rollup: cash it out now
        say('Cashing out your previous climb…');
        if (r.session.equals(this.actor.publicKey) || r.player.equals(this.actor.publicKey)) await this.cashOut(r.asset).catch(() => {});
        else if (Date.now() / 1000 > r.startTs + 66) await this.finishRun(this.me, r.asset).catch(() => {});
        await sleep(800);
      } else if (r.status === RUN.STAKED) {                                     // staked but never begun: refunded after 30 s
        const wait = r.createdTs + 31 - Date.now() / 1000;
        say(`Refunding a climb that did not start${wait > 1 ? ` (${Math.ceil(wait)} s)` : ''}…`);
        if (wait > 0) await sleep(Math.min(wait * 1000, 3000));
        else { await this.finishRun(this.me, r.asset).catch(() => {}); await sleep(800); }
      } else if (over) {                                                        // over on the rollup: on its way back
        if (Date.now() / 1000 > r.endTs + 8) await this.finishRun(this.me, r.asset).catch(() => {});   // commit again if it never left
        await sleep(800);
      } else await sleep(800);
    }
  }
  /// Permissionless: end someone's busted / expired climb on the rollup.
  async finishRun(player, asset) { return send(this.er, [ix.finishRun(this.actor.publicKey, player, asset)], [this.actor], { label: 'finish run' }); }
  /// Permissionless: pay out a climb that is back on Solana.
  async settleRun(player = this.me) {
    const a = await this.waitOnBase(runPda(player));
    const asset = decodeRun(a.data).asset;
    return send(this.base, [ix.settleRun(this.actor.publicKey, player, asset)], [this.actor], { label: 'settle run' });
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
