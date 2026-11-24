// Siroclimb: the contract between the front end and the back end.
//
// The UI only talks to this module. It forwards to the on-chain implementation
// (./api-chain.js: the siroclimb program on Solana devnet and a MagicBlock
// Ephemeral Rollup), or to the in-browser simulation (./api-mock.js) with
// `?mock` in the URL, so the front can still be built and demoed offline.
//
// Units: amounts in test USDC (tUSDC), prices in USD, times in ms since epoch unless noted.
//
//   init()                                   → Promise<{ user: { name }, balance }>
//   connect(walletId?) / account() / disconnect() → wallet + session key: { address } | address | null
//   wallets()                                → [{ id, name }]     injected wallets, plus a devnet burner
//   listAssets()                             → Asset[]            { id, name, ticker, kind: 'stock' | 'metal', hours }
//   marketOpen(assetId)                      → boolean            false outside the market's trading hours
//   marketOpensAt(assetId)                  → ms | null          next session start of a closed market
//   subscribePrice(assetId, cb)              → unsubscribe()      cb({ price, ts })
//   history(assetId, seconds)                → [{ price, ts }]    recent ticks, oldest first
//   rules                                    → { ladder: number[], stepEvery: s, duration: s, roundEntry, prizeSplit }
//   startRun({ mode, assetId, side, stake, pack }) → Promise<Run> mode 'solo', side 'long' | 'short', pack: play the leverage pack
//   onRun(runId, cb)                         → unsubscribe()      cb(RunUpdate) on every price tick
//   cashOut(runId)                           → Promise<RunResult>
//   currentRound()                           → Round              { id, assetId, drawing, opensAt, startsAt, endsAt, status: 'open' | 'live', players, pot, entry, joined, late, runId }
//   onRound(cb)                              → unsubscribe()      cb(Round) every second
//   watchRounds(on)                          → void               the player looks at rounds: this browser may open the next one
//   joinRound({ side })                      → Promise<Round>
//   roundStandings(roundId)                  → Standing[]         { name, pnlPct, status, you } sorted best first
//   leaderboard(scope)                       → Promise<Standing[]> scope 'round' | 'today' | 'all'
//   balance()                                → number
//   onBalance(cb)                            → unsubscribe()
//   faucet()                                 → Promise<number>    tops the test balance back up
//   openPack()                               → Promise<{ tier, maxLeverage, proof, url }>   leverage pack drawn by MagicBlock VRF
//   pack()                                   → { tier, maxLeverage } | null                 the pack waiting to be played
//   proof(runId)                             → [{ label, sig, layer, url }]                  explorer links of a climb's transactions
//   user() / setName(name)                  → { name, address } / Promise<name>   the on-chain handle
//   sessionInfo()                            → Promise<{ key, validUntil, sol } | null>      the game session key
//   shareCard(png, result)                   → Promise<string|null> optional: host the share picture (null = not hosted)
//
// Run        { id, mode, assetId, side, stake, entryPrice, startedAt, ladder, stepEvery, duration }
// RunUpdate  { t (s since start), price, step, leverage, value, pnl, pnlPct, risk (0..1 of the stake lost), status }
// RunResult  { status: 'cashed' | 'busted' | 'expired', value, pnl, pnlPct, maxLeverage, duration (s), entryPrice, exitPrice, rank?, prize? }

const MOCK = new URLSearchParams(location.search).has('mock');
const impl = MOCK ? await import('./api-mock.js') : await import('./api-chain.js');
const opt = (name, fallback) => (impl[name] ? impl[name] : fallback);

export const mock = MOCK;
export const rules = impl.rules;
export const PACKS = impl.PACKS;
export const _debug = impl._debug;
export const init = (...a) => impl.init(...a);
export const connect = (...a) => impl.connect(...a);
export const account = () => impl.account();
export const disconnect = () => impl.disconnect();
export const wallets = opt('wallets', () => [{ id: 'demo', name: 'Demo wallet' }]);
export const listAssets = () => impl.listAssets();
export const marketOpen = opt('marketOpen', () => true);
export const marketOpensAt = opt('marketOpensAt', () => null);
export const subscribePrice = (...a) => impl.subscribePrice(...a);
export const history = (...a) => impl.history(...a);
export const startRun = (...a) => impl.startRun(...a);
export const onRun = (...a) => impl.onRun(...a);
export const cashOut = (...a) => impl.cashOut(...a);
export const runResult = (...a) => impl.runResult(...a);
export const whenEnded = (...a) => impl.whenEnded(...a);
export const runInfo = (...a) => impl.runInfo(...a);
export const currentRound = () => impl.currentRound();
export const onRound = (...a) => impl.onRound(...a);
export const watchRounds = opt('watchRounds', () => {});
export const joinRound = (...a) => impl.joinRound(...a);
export const roundStandings = (...a) => impl.roundStandings(...a);
export const whenRoundFinal = (...a) => impl.whenRoundFinal(...a);
export const leaderboard = (...a) => impl.leaderboard(...a);
export const balance = () => impl.balance();
export const onBalance = (...a) => impl.onBalance(...a);
export const faucet = (...a) => impl.faucet(...a);
export const openPack = (...a) => impl.openPack(...a);
export const pack = opt('pack', () => null);
export const proof = opt('proof', () => []);
export const explorer = opt('explorer', null);
export const sessionInfo = opt('sessionInfo', async () => null);
export const walletKind = opt('walletKind', () => 'demo');
export const climbsLeft = opt('climbsLeft', async () => Infinity);
export const setName = opt('setName', async (n) => n);
export const user = opt('user', () => ({ name: 'You' }));
export const shareCard = (...a) => impl.shareCard(...a);
