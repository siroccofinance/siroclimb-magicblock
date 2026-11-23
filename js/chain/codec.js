// Borsh encoding of instruction arguments (from the IDL) and decoding of the
// program's accounts. Hand-written readers: the layouts are ours and small.
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import idl from './idl.js';

const IX = new Map(idl.instructions.map((i) => [i.name, i]));
const ACC = new Map(idl.accounts.map((a) => [a.name, Buffer.from(a.discriminator)]));
export const errorsByCode = new Map(idl.errors.map((e) => [e.code, e]));

function encodeArg(type, v) {
  if (type === 'u8') return Buffer.from([Number(v) & 0xff]);
  if (type === 'bool') return Buffer.from([v ? 1 : 0]);
  if (type === 'u64' || type === 'i64') {
    const b = Buffer.alloc(8);
    type === 'u64' ? b.writeBigUInt64LE(BigInt(v)) : b.writeBigInt64LE(BigInt(v));
    return b;
  }
  if (type === 'string') {
    const s = Buffer.from(String(v), 'utf8');
    const n = Buffer.alloc(4);
    n.writeUInt32LE(s.length);
    return Buffer.concat([n, s]);
  }
  if (type === 'i32') { const b = Buffer.alloc(4); b.writeInt32LE(Number(v)); return b; }
  if (type === 'pubkey') return Buffer.from(v.toBytes());
  if (type.array && type.array[0] === 'u8') return Buffer.from(v);
  throw new Error('unsupported arg type ' + JSON.stringify(type));
}

/// Instruction data: discriminator + borsh args in IDL order.
export function encodeIx(name, args = {}) {
  const def = IX.get(name);
  if (!def) throw new Error('unknown instruction ' + name);
  return Buffer.concat([Buffer.from(def.discriminator), ...def.args.map((a) => encodeArg(a.type, args[a.name]))]);
}
export const ixAccounts = (name) => IX.get(name).accounts;

class Reader {
  constructor(data, off = 8) { this.d = Buffer.from(data); this.o = off; }
  u8() { return this.d[this.o++]; }
  u32() { const v = this.d.readUInt32LE(this.o); this.o += 4; return v; }
  i32() { const v = this.d.readInt32LE(this.o); this.o += 4; return v; }
  u64() { const v = this.d.readBigUInt64LE(this.o); this.o += 8; return Number(v); }
  i64() { const v = this.d.readBigInt64LE(this.o); this.o += 8; return Number(v); }
  key() { const k = new PublicKey(this.d.subarray(this.o, this.o + 32)); this.o += 32; return k; }
  name(n) { const b = this.d.subarray(this.o, this.o + n); this.o += n; const z = b.indexOf(0); return b.subarray(0, z < 0 ? n : z).toString('utf8'); }
  skip(n) { this.o += n; }
}

export const isAccount = (name, data) => data && data.length >= 8 && Buffer.from(data.subarray(0, 8)).equals(ACC.get(name));
export const discriminator = (name) => ACC.get(name);

export function decodeConfig(data) {
  const r = new Reader(data);
  return { admin: r.key(), usdcMint: r.key(), vault: r.key(), runs: r.u64(), rounds: r.u64(), volume: r.u64(), paid: r.u64() };
}

export function decodeRun(data) {
  const r = new Reader(data);
  return {
    player: r.key(), session: r.key(), nonce: r.u32(), status: r.u8(), mode: r.u8(), asset: r.u8(), side: r.u8(), top: r.u8(), packTier: r.u8(),
    stake: r.u64(), value: r.u64(), entryPrice: r.u64(), lastPrice: r.u64(), createdTs: r.i64(), startTs: r.i64(), lastTickTs: r.i64(), endTs: r.i64(),
    maxStep: r.u8(), ticks: r.u32(), payout: r.u64(), taskId: r.i64(),
  };
}

export const NAME_LEN = 16;
const HISTORY = 8;
export function decodeProfile(data) {
  const r = new Reader(data);
  const p = {
    authority: r.key(), name: r.name(NAME_LEN), createdTs: r.i64(), runs: r.u32(), cashed: r.u32(), busted: r.u32(), expired: r.u32(),
    volume: r.u64(), totalPnl: r.i64(), bestBps: r.i32(), day: r.u32(), dayBestBps: r.i32(), rounds: r.u32(), podiums: r.u32(), wins: r.u32(),
    prizes: r.u64(), packState: r.u8(), packTier: r.u8(), packTs: r.i64(), packs: r.u32(), head: r.u8(), history: [],
  };
  for (let i = 0; i < HISTORY; i++) {
    p.history.push({ ts: r.i64(), stake: r.u64(), pnl: r.i64(), pnlBps: r.i32(), asset: r.u8(), side: r.u8(), mode: r.u8(), status: r.u8(), maxStep: r.u8(), rank: r.u8(), players: r.u8() });
  }
  // newest first, empty slots dropped
  p.history = [...p.history.slice(0, p.head).reverse(), ...p.history.slice(p.head).reverse()].filter((h) => h.ts > 0);
  return p;
}

/// Round is zero-copy (repr(C)): fixed offsets after the 8-byte discriminator.
export const ENTRY_SIZE = 104;
export function decodeRound(data) {
  const d = Buffer.from(data);
  const at = (o) => 8 + o;
  const i64 = (o) => Number(d.readBigInt64LE(at(o)));
  const r = {
    id: i64(0), opensAt: i64(8), startsAt: i64(16), endsAt: i64(24), entry: i64(32), pot: i64(40), entryPrice: i64(48), lastPrice: i64(56),
    liveTs: i64(64), lastTickTs: i64(72), taskId: i64(80), settledTs: i64(88), prizes: [i64(96), i64(104), i64(112)],
  };
  const E = 120, MAXP = 24, T = E + MAXP * ENTRY_SIZE;
  r.ticks = d.readUInt32LE(at(T));
  r.recorded = d.readUInt32LE(at(T + 4));
  r.slot = d[at(T + 8)]; r.status = d[at(T + 9)]; r.asset = d[at(T + 10)]; r.players = d[at(T + 11)];
  r.winners = [d[at(T + 13)], d[at(T + 14)], d[at(T + 15)]];
  r.entries = [];
  for (let i = 0; i < r.players; i++) {
    const o = at(E + i * ENTRY_SIZE);
    const nb = d.subarray(o + 80, o + 96); const z = nb.indexOf(0);
    r.entries.push({
      index: i, player: new PublicKey(d.subarray(o, o + 32)), session: new PublicKey(d.subarray(o + 32, o + 64)),
      value: Number(d.readBigUInt64LE(o + 64)), endTs: Number(d.readBigInt64LE(o + 72)), name: nb.subarray(0, z < 0 ? 16 : z).toString('utf8'),
      side: d[o + 96], status: d[o + 97], maxStep: d[o + 98],
    });
  }
  return r;
}

export function decodeRelay(data) {
  const r = new Reader(data);
  return { market: r.u8(), exponent: r.i32(), raw: r.i64(), ts: r.i64(), updates: r.u64(), relayer: r.key() };
}

/// A market's price account: our relay account, or a MagicBlock Pyth Lazer feed.
export function decodePrice(data) {
  return isAccount('RelayFeed', data) ? decodeRelay(data) : decodeFeed(data);
}

/// A MagicBlock Pyth Lazer feed account: price i64 at 73, publish time i64 at 93.
export function decodeFeed(data) {
  const d = Buffer.from(data);
  return { raw: Number(d.readBigInt64LE(73)), ts: Number(d.readBigInt64LE(93)) };
}
