# Siroclimb on MagicBlock

**A one-minute leverage climb on tokenized stocks, gold and the pound, played on an Ephemeral Rollup and settled on Solana.**

Pick a market (TSLAx, NVDAx, AAPLx, gold or GBP/USD), go long or short: the coin rolls up and down a staircase that follows the live price, leverage climbs from 1x to 4x every 6 seconds over a 60 second climb, and you cash out whenever you like. Your stake is the most you can lose. Solo climbs are played against the house; timed rounds put everyone on the same market for the same minute and split the pot 50 / 30 / 20.

Built for MagicBlock's Solana Blitz v10 (Entertainment Finance). Everything runs on **Solana devnet + MagicBlock's devnet Ephemeral Rollup** with live Pyth Lazer prices pushed into the rollup by MagicBlock.

## Why MagicBlock

A climb is a minute of a position that changes every half second: the price moves, the leverage steps up every 6 seconds, the coin can fall at any tick, and the player can cash out at any instant. On Solana alone that is 120 paid transactions per climb, a wallet prompt per action and 400 ms slots between a click and its effect. On an Ephemeral Rollup the whole minute runs on chain, ticked by the rollup's own crank against MagicBlock's real-time Pyth prices, at zero fee and with 10 ms blocks, while the money (stakes, vault, pots, payouts) never leaves Solana. Session keys remove the last friction: one approval, then every action is instant.

## How a climb runs

```
 Solana devnet (base layer)                      MagicBlock Ephemeral Rollup (devnet-eu)
 ──────────────────────────                      ───────────────────────────────────────
 onboarding, ONE wallet approval:
   profile + 1,000 tUSDC + session key
   (create_session_v2) + spending allowance
 start_run ─ stake to the house vault
   + delegate_run (signed by the session key) ──▶ begin_run   entry = live Pyth Lazer price,
                                                              ScheduleTask: tick_run every 500 ms
                                                 tick_run ×120  crank, on chain, free:
                                                              leverage step, value, bust, bell
                                                 cash_out    (session key, no fee) last step at the
                                                              live price + commit_and_undelegate
 settle_run ◀────────────────────────────────────
   pays the position from the vault, writes the profile (bests, history)
```

A round is the same with one account for the whole field: `open_round` asks MagicBlock's VRF for the market, players `join_round` on Solana, `delegate_round` at the bell, `go_live` sets one entry price for everyone and schedules `tick_round`, each player cashes out on the rollup, `finish_round` commits it back, `settle_round` pays the podium and `record_round` writes every profile.

## MagicBlock features used

| Feature | Where | What it does here |
|---|---|---|
| **Ephemeral Rollups** | `delegate_run`, `delegate_round`, `cash_out`, `finish_round` | The `Run` (solo) and `Round` accounts are delegated for the minute of play. Price ticks, leverage steps, the bust and every cash out run on the rollup at zero fee; the cash out itself commits and undelegates. Money never leaves Solana. |
| **Cranks** (`ScheduleTask`) | `begin_run` → `tick_run`, `go_live` → `tick_round` | The climb ticks itself every 500 ms on the rollup (about 120 ticks per climb). No off-chain ticking loop. Ticks are permissionless and idempotent. |
| **Real-time price oracle** | `begin_run`, `tick_*`, `cash_out*` | MagicBlock's Pyth Lazer feeds on the rollup (`PriCems5…`): TSLA 1435, NVDA 1314, AAPL 922 (the xStocks), XAU/USD 346. Addresses pinned per market, owner checked, staleness bound: a stale price holds the climb still and blocks new climbs (market closed). |
| **VRF** | `open_round` → `draw_round_market`, `open_pack` → `apply_pack` | The market of every round and the tier of every leverage pack are drawn by MagicBlock's VRF; callbacks are only accepted from the VRF program's scoped identity. |
| **Session keys** (`session-keys`, `SessionTokenV2`) | `start_run`, `join_round`, `open_pack`, every rollup action | The wallet approves once. A browser-held session key, authorised by a `SessionTokenV2` and approved as SPL spender of the wallet's test USDC, signs every stake, cash out, join and pack with no wallet prompt (wallets cannot sign rollup transactions anyway). |

### Markets and prices

| Market | Price | When it moves |
|---|---|---|
| TSLAx, NVDAx, AAPLx | Pyth Lazer US equity feeds on the rollup (the xStocks track their share 1:1) | Sun 20:00 to Fri 20:00 New York: pre-market, regular, post-market and overnight sessions |
| Gold (XAU/USD) | Pyth Lazer metal feed on the rollup | Sun 18:00 to Fri 17:00 New York, with a daily hour off |
| GBP/USD | The program's `RelayFeed` account on the rollup | Pushed every second by the relay key (`/api/relay`, keeper) from Kraken's public GBP/USD book, which trades every day |

Outside its sessions a market shows **closed** in the lobby and rounds do not draw it. The front checks Pyth's published session schedules (New York time, holidays included: stocks close on Thanksgiving until the overnight session) as well as the price's freshness, because Pyth keeps publishing a frozen price with a fresh timestamp while a market is closed. The program refuses to start a climb on a stale price (`StalePrice`) and holds a live climb still while its price is stale. On weekends only GBP/USD plays.

Why a relay for GBP/USD: MagicBlock's rollups carry no FX feed (checked on devnet-eu, -as and -us), Pyth's devnet push account was 16 minutes stale, and our Pyth key is not entitled to FX. The relay is honest about its trust: one named key, prices only move forward, and swapping in signed Pyth Lazer FX updates is a one-function change once entitled.

Real minute-scale moves are tiny (Tesla moves about 0.07 % in three minutes after hours), so each market's move is **boosted** before leverage applies, tuned from the feeds' per-second volatility (TSLAx 90, NVDAx 25, AAPLx 90, gold 180, GBP/USD 400). A boost is a game rule, stated in the rules sheet.

The xStocks have no devnet mints, so devnet mirrors were created with the same name, symbol and decimals (Token-2022, 8 decimals); see [DEPLOYMENTS.md](DEPLOYMENTS.md).

## What lives where

| | Solana (base) | Ephemeral Rollup | Off-chain |
|---|---|---|---|
| Sirocco test USDC (tUSDC), faucet, house vault, payouts | ✓ | | |
| Stakes, round entries and pots | ✓ | | |
| Session authorisation (`SessionTokenV2`) and spending allowance | ✓ | | |
| Live climbs and rounds: entry price, ticks, leverage, bust, cash out | | ✓ | |
| Prices (Pyth Lazer pushed by MagicBlock) | | ✓ | |
| GBP/USD relay account | | ✓ | relay key (serverless route) |
| Profiles: handle, record, bests, last 8 climbs, pack | ✓ | | |
| VRF draws: round market, leverage packs | ✓ | | |
| Leaderboards (today, all time, last round) | read | | front |
| Round autopilot: open, delegate, go live, finish, settle, record | ✓ | ✓ | any browser (permissionless) |
| Practice players when a round is nearly empty | ✓ | ✓ | in the browser |

**Serverless.** Nothing has to run on our side for the game to work: every step of a climb or a round is permissionless, and the page itself pushes each one along (autopilot). When a round is nearly empty, up to three practice players join from your own browser: real keypairs with their own profile and test USDC, funded once by your session key, that play their seat on the rollup. The optional keeper (`npm run keeper`) only makes the lobby feel alive when nobody is online. The two serverless routes are a devnet SOL faucet for new wallets and the GBP/USD relay.

## Leverage packs

Every 10 minutes a player can open a free pack: MagicBlock's VRF draws a tier (Bronze 1.5x 45 %, Silver 2x 28 %, Gold 3x 18 %, Diamond 4x 9 %) and the pack is a 10 tUSDC climb on the house whose ladder tops out at that tier. The player keeps the gain, the house eats the loss.

## Deployed (devnet)

| | Address |
|---|---|
| Program | [`29sucV8aHGufy1AWrKzgp9gBPRHBG9jSxAsSWXe7M2ov`](https://explorer.solana.com/address/29sucV8aHGufy1AWrKzgp9gBPRHBG9jSxAsSWXe7M2ov?cluster=devnet) |
| Rollup | `https://devnet-eu.magicblock.app` (validator `MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e`, magicblock-core 2.0.4) |

Every account, mint and explorer link: [DEPLOYMENTS.md](DEPLOYMENTS.md). Each climb's result screen links every transaction of that climb (Solana and rollup) to the explorer.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:3042: the site + /api/relay + /api/faucet
```

Open the page, **Start playing**, pick an open market and **Start climbing**. Connect Phantom / Solflare / Backpack on devnet, or the built-in **burner wallet** (devnet SOL comes from the site's faucet). The first climb asks for one approval; every later action is instant. `?mock` runs the old in-browser simulation, no chain. `#play` opens the lobby directly.

### Hosting (Vercel-ready, not deployed)

The site is static (no build step: `index.html`, `play.css`, `js/`, `assets/`); `api/relay.js` and `api/faucet.js` are Vercel Node functions. Import the repo in Vercel with no framework preset and set two server-side environment variables:

| Variable | What |
|---|---|
| `RELAYER_SECRET_KEY` | JSON array of the relay keypair (`~/.config/siroclimb/relayer.json`), named in the relay account |
| `FAUCET_SECRET_KEY` | JSON array of a funded devnet keypair (`~/.config/siroclimb/faucet.json`) |

Without them the game still works: GBP/USD shows closed and new wallets need devnet SOL from faucet.solana.com.

### Ops scripts (keys in `~/.config/siroclimb/`, never in the repo)

| Command | |
|---|---|
| `npm run chain:build` | `anchor build` in `chain/` |
| `npm run chain:test` | Rust unit tests of the game rules |
| `npm run setup` | one-time, idempotent: mint, vault, config, house bankroll, round slots, relay |
| `npm run probe` | one session-keyed climb through the rollup, step by step (`ASSET=4` for GBP/USD) |
| `npm run battery -- 24 2 2` | on-chain battery: players, rounds, solo waves ([BATTERY.md](BATTERY.md)) |
| `npm run test:ui` | the real front from an empty burner, headless Chrome (`FLOW=round` for a round) |
| `npm run keeper` | optional keeper: relay, rounds, house players, sweeper |

## Tests and results

| Suite | Command | Result |
|---|---|---|
| Game rules (Rust unit) | `npm run chain:test` | 10 / 10 |
| On-chain battery, solo | `npm run battery -- 24 2 2` | 48 simultaneous climbs by 24 session-keyed players, refusals, VRF packs: 338 / 342 (the 4 failures: one stuck round slot, fixed) |
| On-chain battery, rounds | `npm run battery -- 24 2 0` | two full 24-seat rounds drawn by VRF, every payout checked: 66 / 67 (one test bug, fixed) |
| Browser, solo climb from an empty burner | `npm run test:ui` | onboarding, climb, cash out, 4 explorer proof links, 0 console errors |
| Browser, round with practice players | `FLOW=round npm run test:ui` | joined, 3 practice players seated, cashed out, finished 1st of 4, 20 tUSDC prize paid, 0 console errors |
| Simulation flows (`?mock`) | `npm run test:solo` etc. | the original Puppeteer flows of the front |

Bugs the tests found and how each was fixed: [FINDINGS.md](FINDINGS.md).

## Latencies (battery medians, devnet + devnet-eu)

| Step | Median |
|---|---|
| stake + delegate (Solana) | 1.0 s |
| delegation visible on the rollup | 20 ms |
| begin at the oracle price + schedule the crank (rollup) | 0.37 s |
| cash out + commit/undelegate (rollup) | 0.34 s |
| back on Solana after the cash out | 0.9 s |
| settle (Solana) | 1.05 s |
| round market VRF callback / pack VRF callback | 0.6 to 0.7 s / 1.1 s |

## Known gaps

- **Market hours on chain.** The program enforces price freshness, not trading sessions: someone calling it directly could start a climb on a closed market's frozen price. The front, keeper and battery never do. Enforcing Pyth's schedules on chain is the next step.
- **GBP/USD trust.** The relay is one named key fed from Kraken. MagicBlock has no FX feed on its rollups and our Pyth key is not entitled to FX; with an FX entitlement the relay would post signed Pyth Lazer updates instead.
- **Delegation cost.** Each climb is one delegation, about 0.003 SOL of protocol fees on magicblock-core 2.0 (FINDINGS #4), paid by the session key. Keeping a player's run account delegated between climbs would remove it; not done for the hackathon.
- **History.** The lobby's sparkline and 60 s change start from the moment the page opens (Pyth's history API needs an entitlement we lack).
- **Not hosted.** The repo is Vercel-ready (static site + two functions) but not deployed.

## Repository

```
chain/programs/siroclimb/src/
  lib.rs     instructions (Solana and rollup), account contexts, price reading
  game.rs    climb, round, profile and pack rules, unit tests
  token.rs   minimal SPL token helpers (no anchor-spl: half the binary, half the rent)
js/chain/    isomorphic client (browser + node): config, PDAs, IDL builders, decoders,
             sending, session keys, wallets, handles, the GBP/USD relay, Climber
js/api.js    the front's contract; js/api-chain.js serves it from the chain,
             js/api-mock.js is the old simulation (?mock)
js/game.js   screens, HUD, leverage gauge, sound, scene driving
api/         serverless routes: relay, faucet
ops/         setup, probes, battery, keeper, dev server, browser tests
3d/, assets/ the Three.js scene sources, hero films, brand marks
```
