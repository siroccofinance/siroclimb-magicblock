// Chain errors as short sentences for the UI (never raw InstructionError JSON).
import { errorsByCode } from './codec.js';
import { errorCode } from './tx.js';

const ANCHOR = {
  0: 'That account already exists',
  1: 'Not enough SOL for the network fee',
  2006: 'Seeds mismatch, refresh and try again',
  3007: 'Your previous climb is still settling, one moment',
  3012: 'Account not created yet',
};
const FRIENDLY = {
  FaucetCooldown: 'Faucet: wait a few seconds between top ups',
  InsufficientFunds: 'Not enough test tokens',
  SessionExpired: 'Your game session expired, reconnect to renew it',
  RunInProgress: 'Your previous climb is still settling, one moment',
  StalePrice: 'This market is closed right now, pick another one',
  TooLate: 'This round has started, join the next one',
  RoundFull: 'This round is full, join the next one',
  AlreadyJoined: "You're already in this round",
  PackCooldown: 'Next pack in a few minutes',
  NoPack: 'No pack to play',
  SlotBusy: 'The next round is still being set up',
};

export function friendlyError(e) {
  const msg = String((e && e.message) || e);
  const code = errorCode(e);
  if (code !== null) {
    const def = errorsByCode.get(code);
    if (def) return FRIENDLY[def.name] || def.msg;
    if (ANCHOR[code]) return ANCHOR[code];
    return `Transaction refused (code ${code})`;
  }
  if (/User rejected|rejected the request|denied/i.test(msg)) return 'Cancelled in the wallet';
  if (/insufficient lamports|InsufficientFunds"|0x1\b|AccountNotFound|insufficient funds/i.test(msg)) return 'Not enough devnet SOL for the network fee';
  if (/not confirmed/i.test(msg)) return 'The network did not confirm in time, try again';
  if (/Failed to fetch|NetworkError|ECONN|fetch failed/i.test(msg)) return 'Network unreachable, check your connection';
  if (/InstructionError|\{"/.test(msg)) return 'Transaction refused by the network';
  return msg.slice(0, 140);
}
