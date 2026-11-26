// Addresses, endpoints and game constants shared by the front, the ops
// scripts (keeper, bots, battery) and the tests.
//
//   BASE  Solana devnet: faucet, stakes, settlement, profiles, VRF.
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
/// VRF oracle queue for requests made on Solana (leverage packs).
export const VRF_BASE_QUEUE = new PublicKey('Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh');
export const SLOT_HASHES = new PublicKey('SysvarS1otHashes111111111111111111111111111');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
/// The market tokens (the xStock and XAUt mirrors) are Token-2022 mints, like the real xStocks.
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
export const PRICE_ORACLE_PROGRAM_ID = new PublicKey('PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd');

/// The five markets, in on-chain order: four xStocks and gold, all open 24/7.
///
/// Every market is priced on the rollup by the program's relay accounts
/// (`["relay", asset]`), kept fresh with the asset's own 24/7 token market
/// (js/chain/relay.js) by /api/relay, its cron and the keeper: the mid of
/// Kraken's book (`relay`: the xStock pairs, XAUt/USD for gold) averaged with Hyperliquid's trade.xyz
/// 24/7 perp (`hl`) when the two agree within 1.5 %, or with
/// `source: 'jupiter'`, Jupiter's price of the Solana mint (`mainnetMint`).
/// The other venue is the sanity check. MagicBlock's rollups carry no xStock
/// feed, Pyth's equity feeds stand still outside US hours and Pyth's XAU/USD
/// closes on weekends, which is why the game prices from the tokens themselves.
///
/// `hours`: when the price moves; '24/7' for every market.
export const MARKETS = [
  { id: 'TSLAx', name: 'Tesla', ticker: 'TSLAx', kind: 'stock', relay: 'TSLAxUSD', hl: 'xyz:TSLA', exponent: -5, feed: 'EZzYNjVe8T3SfPiRknV4JA9JTfbfeBfWRoD8CymuUUHu', hours: '24/7',
    mint: 'EwksJmGYpSHWwznpeX8XGqHPBEhqyH4nHX92WH7uUz8g', mainnetMint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB' },
  { id: 'NVDAx', name: 'NVIDIA', ticker: 'NVDAx', kind: 'stock', relay: 'NVDAxUSD', hl: 'xyz:NVDA', exponent: -5, feed: 'AuewuoKKM4GSphTixn1oHS4o37jZrFcghgSvUc5dJXF7', hours: '24/7',
    mint: '4hqVYfXyqy1R1Yr7hbRvq7veqqvrKCb7mXZE1CZdqdfJ', mainnetMint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh' },
  { id: 'AAPLx', name: 'Apple', ticker: 'AAPLx', kind: 'stock', relay: 'AAPLxUSD', hl: 'xyz:AAPL', exponent: -5, feed: 'BMPPdknGVDDzPsRSwnhHyuR1YwmJ9xM9ij841S96rXY5', hours: '24/7',
    mint: 'yDvobkVXoAmXRPhJXn9C7nfh6GN3ppo9NiiEXyYdNBb', mainnetMint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp' },
  // gold as XAUt (Tether Gold), which trades 24/7: Kraken's XAUt/USD book, Jupiter's XAUt0 on Solana as the check
  { id: 'XAU', name: 'Gold', ticker: 'XAUt', kind: 'metal', relay: 'XAUTUSD', hl: 'xyz:GOLD', exponent: -3, feed: 'CGNjvcw4CJBdYKiV4aGVjqvgmMQfA9pTnz2V2bqzBp8N', hours: '24/7',
    mint: 'FWruv7WP2BuuL3ThDxfuGum1HGHe5uCMqTr8twJNaSQG', mainnetMint: 'AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P', decimals: 6 },
  { id: 'MSTRx', name: 'MicroStrategy', ticker: 'MSTRx', kind: 'stock', relay: 'MSTRxUSD', hl: 'xyz:MSTR', exponent: -5, feed: '2k53rB3byWy3dEQobyjZCfrMhhPJ5FmVbtp66KwwprWr', hours: '24/7',
    mint: '9kHuWdmvbsY3GUH55NyWc4zmfkRBjcse8mXUD4zrERdX', mainnetMint: 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ' },
].map((m, index) => ({ decimals: 8, ...m, index, feedKey: new PublicKey(m.feed), mintKey: new PublicKey(m.mint) }));
export const marketIndex = (id) => MARKETS.findIndex((m) => m.id === id);

// Mirrors of the program's constants (chain/programs/siroclimb/src).
export const USDC_DECIMALS = 6;
export const ONE_USDC = 1_000_000;
export const LADDER = [1, 1.5, 2, 2.5, 3, 3.5, 4];
export const STEP_SECONDS = 6;
export const RUN_SECONDS = 60;
export const BOOST = [90, 25, 90, 180, 25];
/// Markets priced by the program's relay accounts (the others by MagicBlock's oracle).
export const RELAY_ASSETS = [0, 1, 2, 3, 4];
/// The Sirocco desk's spread on every fill (basis points), mirrored from the program's Desk account.
export const DESK_SPREAD_BPS = 5;
/// Retired round slots still on chain until closed.
export const ROUND_SLOTS = 4;
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
export const PACK = { NONE: 0, DRAWING: 1, READY: 2 };
export const NONE = 255;

export const EXPLORER = (kind, id, cluster = 'devnet') => `https://explorer.solana.com/${kind}/${id}?cluster=${cluster}`;
/// Solana Explorer pointed at the rollup, for rollup transactions and accounts.
export const ER_EXPLORER = (kind, id) => `https://explorer.solana.com/${kind}/${id}?cluster=custom&customUrl=${encodeURIComponent(ER_RPC)}`;
