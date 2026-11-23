// Addresses, endpoints and game constants shared by the front, the ops
// scripts (keeper, bots, battery) and the tests.
//
//   BASE  Solana devnet: faucet, stakes, round entries, settlement, profiles, VRF.
//   ER    The MagicBlock Ephemeral Rollup the climbs are delegated to.
//
// Overrides (all optional): `globalThis.SIROCLIMB_ENV` in the browser, the
// same keys as environment variables in node.
import { PublicKey } from '@solana/web3.js';
import deployment from './deployment.js';

const env = (k) => (globalThis.SIROCLIMB_ENV && globalThis.SIROCLIMB_ENV[k]) || (globalThis.process && globalThis.process.env && globalThis.process.env[k]) || undefined;

export const PROGRAM_ID = new PublicKey(env('SIROCLIMB_PROGRAM_ID') || deployment.programId);
export const USDC_MINT = deployment.usdcMint ? new PublicKey(env('SIROCLIMB_USDC_MINT') || deployment.usdcMint) : null;
export const VAULT = deployment.vault ? new PublicKey(deployment.vault) : null;

/// MagicBlock's devnet RPC: the public Solana one rate-limits bursts (429).
export const BASE_RPC = env('SIROCLIMB_BASE_RPC') || 'https://rpc.magicblock.app/devnet';
/// devnet-eu: closest to the team, and its feeds tick every 50-200 ms like the others.
export const ER_RPC = env('SIROCLIMB_ER_RPC') || 'https://devnet-eu.magicblock.app';
export const ER_VALIDATOR = new PublicKey(env('SIROCLIMB_ER_VALIDATOR') || 'MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e');

export const DELEGATION_PROGRAM_ID = new PublicKey('DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh');
export const MAGIC_PROGRAM_ID = new PublicKey('Magic11111111111111111111111111111111111111');
export const MAGIC_CONTEXT_ID = new PublicKey('MagicContext1111111111111111111111111111111');
export const SESSION_PROGRAM_ID = new PublicKey('KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5');
export const VRF_PROGRAM_ID = new PublicKey('Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz');
/// VRF oracle queue for requests made on Solana (round markets, packs).
export const VRF_BASE_QUEUE = new PublicKey('Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh');
export const SLOT_HASHES = new PublicKey('SysvarS1otHashes111111111111111111111111111');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
export const PRICE_ORACLE_PROGRAM_ID = new PublicKey('PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd');

/// The six markets, in on-chain order. Prices are MagicBlock's Pyth Lazer
/// feeds on the rollup: PDA("price_feed", "pyth-lazer", lazerId) of the
/// oracle program; `exponent` from Pyth Lazer's symbol list.
export const MARKETS = [
  { id: 'BTC', name: 'Bitcoin', ticker: 'BTC', kind: 'crypto', lazerId: 1, exponent: -8, feed: '71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr' },
  { id: 'ETH', name: 'Ethereum', ticker: 'ETH', kind: 'crypto', lazerId: 2, exponent: -8, feed: '5vaYr1hpv8yrSpu8w3K95x22byYxUJCCNCSYJtqVWPvG' },
  { id: 'SOL', name: 'Solana', ticker: 'SOL', kind: 'crypto', lazerId: 6, exponent: -8, feed: 'ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu' },
  { id: 'TSLA', name: 'Tesla', ticker: 'TSLA', kind: 'stock', lazerId: 1435, exponent: -5, feed: '8L7ccCxTBZaLsMMdhAod5fFnpdEWGSDPW4y1td7y3y8N' },
  { id: 'NVDA', name: 'NVIDIA', ticker: 'NVDA', kind: 'stock', lazerId: 1314, exponent: -5, feed: '3AD13yFytFWiLQbcGsnEXDeWZ9GZezSx6Y3NqZRoJMaC' },
  { id: 'AAPL', name: 'Apple', ticker: 'AAPL', kind: 'stock', lazerId: 922, exponent: -5, feed: 'B3P5AnSryJKeMk3FZcXsmpKVqoNmGYQE1rfE5KaoZNt1' },
].map((m, index) => ({ ...m, index, feedKey: new PublicKey(m.feed) }));
export const marketIndex = (id) => MARKETS.findIndex((m) => m.id === id);

// Mirrors of the program's constants (chain/programs/siroclimb/src).
export const USDC_DECIMALS = 6;
export const ONE_USDC = 1_000_000;
export const LADDER = [1, 1.5, 2, 2.5, 3, 3.5, 4];
export const STEP_SECONDS = 6;
export const RUN_SECONDS = 60;
export const BOOST = [70, 55, 35, 80, 25, 70];
export const ROUND_CYCLE = 80;
export const ROUND_JOIN_SECONDS = 20;
export const ROUND_SLOTS = 4;
export const ROUND_ENTRY = 10;
export const MAX_PLAYERS = 24;
export const PRIZE_SPLIT = [0.5, 0.3, 0.2];
export const MAX_PRICE_AGE = 10;
export const PACK_STAKE = 10;
export const PACK_COOLDOWN = 600;
export const FAUCET_TARGET = 1000;
export const PACKS = [
  { tier: 'Bronze', maxLeverage: 1.5, odds: 0.45, top: 1 },
  { tier: 'Silver', maxLeverage: 2, odds: 0.28, top: 2 },
  { tier: 'Gold', maxLeverage: 3, odds: 0.18, top: 4 },
  { tier: 'Diamond', maxLeverage: 4, odds: 0.09, top: 6 },
];

export const RUN = { FREE: 0, STAKED: 1, LIVE: 2, CASHED: 3, BUSTED: 4, EXPIRED: 5, SETTLED: 6 };
export const ROUND = { FREE: 0, DRAWING: 1, OPEN: 2, LIVE: 3, FINISHED: 4, SETTLED: 5 };
export const PACK = { NONE: 0, DRAWING: 1, READY: 2 };
export const NONE = 255;

export const EXPLORER = (kind, id, cluster = 'devnet') => `https://explorer.solana.com/${kind}/${id}?cluster=${cluster}`;
/// Solana Explorer pointed at the rollup, for rollup transactions and accounts.
export const ER_EXPLORER = (kind, id) => `https://explorer.solana.com/${kind}/${id}?cluster=custom&customUrl=${encodeURIComponent(ER_RPC)}`;
