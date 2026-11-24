// The Sirocco Reserve's math, mirrored from the program (chain/.../reserve.rs)
// so the front shows the same borrow, cost and share price as the chain.
// Amounts here are raw tUSDC units (6 decimals) unless noted.
import { LADDER, RUN_SECONDS, STEP_SECONDS } from './config.js';

export const MAX_PAYOUT_MULT = 5;
export const BORROW_APR_BPS = 3650;   // 36.5 % a year
export const BORROW_FEE_BPS = 10;     // 0.1 % of the peak borrow
const SECONDS_PER_YEAR = 31_536_000;
const lev10 = (step) => Math.round(LADDER[step] * 10);
const stepAt = (t, top) => Math.min(top, Math.max(0, Math.min(LADDER.length - 1, Math.floor(t / STEP_SECONDS))));

export const assetsOf = (vault, staked) => Math.max(0, vault - staked);
export const sharesFor = (amount, assets, shares) => (shares === 0 || assets === 0 ? amount : Math.floor((amount * shares) / assets));
export const valueOf = (n, assets, shares) => (shares === 0 ? 0 : Math.floor((n * assets) / shares));
/// Borrowed at a ladder step: stake x (leverage - 1).
export const borrowedAt = (stake, step) => Math.floor((stake * (lev10(step) - 10)) / 10);
/// Fee on the peak borrow + interest per second borrowed (BigInt-exact like the program).
export function borrowCost(stake, seconds, top, maxStep) {
  const s = BigInt(Math.round(stake));
  const fee = (BigInt(borrowedAt(stake, maxStep)) * BigInt(BORROW_FEE_BPS)) / 10_000n;
  let levSeconds = 0n;
  for (let t = 0; t < Math.max(0, Math.min(RUN_SECONDS, Math.floor(seconds))); t++) levSeconds += BigInt(lev10(stepAt(t, top)) - 10);
  const interest = (s * levSeconds * BigInt(BORROW_APR_BPS)) / (10n * 10_000n * BigInt(SECONDS_PER_YEAR));
  return Number(fee + interest);
}
/// A reserve account read into numbers the UI shows (tUSDC, not raw).
export function reserveView(r, vault, nowS = Date.now() / 1000) {
  const assets = assetsOf(vault, r.staked);
  const price = r.shares ? assets / r.shares : 1;
  const years = Math.max(1 / 365, (nowS - r.createdTs) / SECONDS_PER_YEAR);
  return {
    tvl: assets / 1e6, shares: r.shares / 1e6, sharePrice: price, free: Math.max(0, assets - r.reserved) / 1e6,
    reserved: r.reserved / 1e6, lines: r.lines / 1e6, utilization: assets ? r.reserved / assets : 0,
    apy: (price - 1) / years, fees: r.fees / 1e6, runs: r.runs, borrowedVolume: r.borrowedVolume / 1e6,
    paidToPlayers: r.paidToPlayers / 1e6, keptFromPlayers: r.keptFromPlayers / 1e6, aprBorrow: BORROW_APR_BPS / 100, feeBps: BORROW_FEE_BPS,
  };
}
