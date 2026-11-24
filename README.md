# Siroclimb on MagicBlock

**A one-minute leverage climb on tokenized stocks and gold, played on an Ephemeral Rollup and settled on Solana.**

Pick a market (TSLAx, NVDAx, AAPLx, GMEx or gold), go long or short: the coin rolls up and down a staircase that follows the live price, leverage climbs from 1x to 4x every 6 seconds over a 60 second climb, and you cash out whenever you like. Your stake is the most you can lose. Climbs are solo, played against the house vault.

Built for MagicBlock's Solana Blitz v10 (Entertainment Finance). Everything runs on **Solana devnet + MagicBlock's devnet Ephemeral Rollup** with live Pyth Lazer prices pushed into the rollup by MagicBlock.

## Why MagicBlock

A climb is a minute of a position that changes every half second: the price moves, the leverage steps up every 6 seconds, the coin can fall at any tick, and the player can cash out at any instant. On Solana alone that is 120 paid transactions per climb, a wallet prompt per action and 400 ms slots between a click and its effect. On an Ephemeral Rollup the whole minute runs on chain, ticked by the rollup's own crank against MagicBlock's real-time Pyth prices, at zero fee and with 10 ms blocks, while the money (stakes, vault, payouts) never leaves Solana. Session keys remove the last friction: one approval, then every action is instant.

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

Timed rounds (everyone on the same market, a pot split 50 / 30 / 20) were removed on 24 Nov 2026 to keep the game solo; their four slot accounts were closed with `close_round_slot` and their rent returned (see [DEPLOYMENTS.md](DEPLOYMENTS.md)).

## MagicBlock features used

| Feature | Where | What it does here |
|---|---|---|
| **Ephemeral Rollups** | `delegate_run`, `cash_out`, `finish_run` | The `Run` account is delegated for the minute of play. Price ticks, leverage steps, the bust and every cash out run on the rollup at zero fee; the cash out itself commits and undelegates. Money never leaves Solana. |
| **Cranks** (`ScheduleTask`) | `begin_run` → `tick_run` | The climb ticks itself every 500 ms on the rollup (about 120 ticks per climb). No off-chain ticking loop. Ticks are permissionless and idempotent. |
| **Real-time price oracle** | `begin_run`, `tick_run`, `cash_out`, `finish_run` | MagicBlock's Pyth Lazer feeds on the rollup (`PriCems5…`): TSLA 1435, NVDA 1314, AAPL 922, GME 1160 (the xStocks), XAU/USD 346. Addresses pinned per market, owner checked, staleness bound: a stale price holds the climb still and blocks new climbs (market closed). |
| **VRF** | `open_pack` → `apply_pack` | The tier of every leverage pack is drawn by MagicBlock's VRF; callbacks are only accepted from the VRF program's scoped identity. |
| **Session keys** (`session-keys`, `SessionTokenV2`) | `start_run`, `open_pack`, every rollup action | The wallet approves once. A browser-held session key, authorised by a `SessionTokenV2` and approved as SPL spender of the wallet's test USDC, signs every stake, cash out and pack with no wallet prompt (wallets cannot sign rollup transactions anyway). |

### Markets and prices

| Market | Price | When it moves |
|---|---|---|
| TSLAx, NVDAx, AAPLx, GMEx | Pyth Lazer US equity feeds on the rollup (the xStocks track their share 1:1) | Sun 20:00 to Fri 20:00 New York: pre-market, regular, post-market and overnight sessions |
| Gold (XAU/USD) | Pyth Lazer metal feed on the rollup | Sun 18:00 to Fri 17:00 New York, with a daily hour off |

Outside its sessions a market shows **closed** in the lobby. The front checks Pyth's published session schedules (New York time, holidays included: stocks close on Thanksgiving until the overnight session) as well as the price's freshness, because Pyth keeps publishing a frozen price with a fresh timestamp while a market is closed. The program enforces the same sessions on chain (`hours.rs`: New York time, daylight time and holidays included, tested against the front's answers on 3,000 instants and in LiteSVM with the clock set to a Saturday, Thanksgiving and a Friday 20:00 bell): no stake and no start outside a session (`MarketClosed`). It also refuses a stale price (`StalePrice`) and holds a live climb still while its price is stale. On weekends every market is closed.

Why GMEx: Amazon, Meta, Microsoft and Alphabet were the first picks for a fourth stock, but MagicBlock pushes none of them into its rollups (checked on devnet-eu, -us, -as and the mainnet rollups on 24 Nov 2026). The only other US equity feed on devnet-eu is GameStop (Pyth Lazer 1160, fresh every 50 to 200 ms, same sessions as the other stocks), and GameStop trades on Solana as the GMEx xStock, so every market is read the same way: a MagicBlock price account, no relay, no trusted key.

The charts open full: the last 90 seconds of each market are read back from its price account's update transactions on the rollup (keyless, same source as the live price; `js/chain/history.js`).

Real minute-scale moves are tiny (Tesla moves about 0.07 % in three minutes after hours), so each market's move is **boosted** before leverage applies, tuned from the feeds' per-second volatility (TSLAx 90, NVDAx 25, AAPLx 90, gold 180, GMEx 55; GameStop ticks a cent at a time and moves about 0.7 bp a second, so 55 gives it the same boosted swing as AAPLx and NVDAx). A boost is a game rule, stated in the rules sheet.

The xStocks have no devnet mints, so devnet mirrors were created with the same name, symbol and decimals (Token-2022, 8 decimals); see [DEPLOYMENTS.md](DEPLOYMENTS.md).

## What lives where

| | Solana (base) | Ephemeral Rollup | Off-chain |
|---|---|---|---|
| Sirocco test USDC (tUSDC), faucet, house vault, payouts | ✓ | | |
| Stakes | ✓ | | |
| Session authorisation (`SessionTokenV2`) and spending allowance | ✓ | | |
| Live climbs: entry price, ticks, leverage, bust, cash out | | ✓ | |
| Prices (Pyth Lazer pushed by MagicBlock) | | ✓ | |
| Profiles: handle, record, bests, last 8 climbs, pack | ✓ | | |
| VRF draws: leverage packs | ✓ | | |
| Leaderboards (today, all time) | read | | front |
| Climb autopilot: finish and settle a climb left behind | ✓ | ✓ | any browser (permissionless) |

**Wallet state in sight.** The wallet menu shows the on-chain handle (renamable), until when the game session key is valid and how many climbs its fuel still pays for; the balance reads "–" until a wallet connects; errors are short sentences ("This market is outside its trading hours, pick another one"), never raw transaction errors.

**Serverless.** Nothing has to run on our side for the game to work: every step of a climb is permissionless, and the page itself pushes each one along (autopilot). The optional keeper (`npm run keeper`) only sweeps climbs left on the rollup by closed tabs. The one serverless route is a devnet SOL faucet for new wallets.

## Leverage packs

Every 10 minutes a player can open a free pack: MagicBlock's VRF draws a tier (Bronze 1.5x 45 %, Silver 2x 28 %, Gold 3x 18 %, Diamond 4x 9 %) and the pack is a 10 tUSDC climb on the house whose ladder tops out at that tier. The player keeps the gain, the house eats the loss.

## Deployed (devnet)

| | Address |
|---|---|
| Program | [`BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ`](https://explorer.solana.com/address/BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ?cluster=devnet) |
| Rollup | `https://devnet-eu.magicblock.app` (validator `MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e`, magicblock-core 2.0.4) |

Every account, mint and explorer link: [DEPLOYMENTS.md](DEPLOYMENTS.md). Each climb's result screen links every transaction of that climb (Solana and rollup) to the explorer.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:3042: the site + /api/faucet
```

Open the page, **Start playing**, pick an open market and **Start climbing**. Connect Phantom / Solflare / Backpack on devnet, or the built-in **burner wallet** (devnet SOL comes from the site's faucet). The first climb asks for one approval; every later action is instant. `?mock` runs the old in-browser simulation, no chain. `#play` opens the lobby directly.

### Hosting (Vercel, live at https://siroclimb.sirocco.finance)

The site is static (no build step: `index.html`, `play.css`, `js/`, `assets/`); `api/faucet.js` is a Vercel Node function. Import the repo in Vercel with no framework preset and set one server-side environment variable:

| Variable | What |
|---|---|
| `FAUCET_SECRET_KEY` | JSON array of a funded devnet keypair (`~/.config/siroclimb/solana/faucet.json`) |

Without it the game still works: new wallets need devnet SOL from faucet.solana.com.

### Ops scripts (keys in `~/.config/siroclimb/solana/`, never in the repo)

Every script signs with Siroclimb's own deployer (`~/.config/siroclimb/solana/deployer.json`, or `SIROCLIMB_DEPLOYER`) and refuses the Solana CLI default wallet; `npm run chain:deploy` names it as payer and upgrade authority, `npm run mirrors` creates the xStock mirrors with it.

| Command | |
|---|---|
| `npm run chain:build` | `anchor build` in `chain/` |
| `npm run chain:test` | Rust unit tests of the game rules |
| `npm run setup` | one-time, idempotent: mint, vault, config, house bankroll |
| `npm run probe` | one session-keyed climb through the rollup, step by step (`ASSET=4` for GMEx) |
| `npm run battery -- 24 2` | on-chain battery: players, solo waves, refusals, packs ([BATTERY.md](BATTERY.md)) |
| `npm run test:ui` | the real front in headless Chrome (`FLOW=pack`, `menu`; `MARKET=GMEx` picks the market; `FRESH=1` from an empty burner) |
| `npm run ci` | every CI step, locally |
| `npm run test:hours` | the on-chain market hours in LiteSVM (after `npm run chain:build`) |
| `npm run keeper` | optional keeper: sweeps climbs left behind |

## Tests and results

| Suite | Command | Result |
|---|---|---|
| Game rules and sessions (Rust unit) | `npm run chain:test` | 13 / 13, including 3,000 instants matched against the front's schedule reader |
| Market hours and retired round slots on the built program (LiteSVM) | `npm run test:hours` | 14 / 14 |
| On-chain battery | `npm run battery -- 24 2` | solo only (`-- 8 1`): **118 / 118**: 8 simultaneous climbs on all five markets, refusals, VRF packs; earlier, with rounds: **404 / 404** (48 simultaneous climbs by 24 session-keyed players, two full 24-seat rounds drawn by VRF) and **132 / 132** after the GMEx upgrade ([BATTERY.md](BATTERY.md); earlier runs found FINDINGS #6, #7, #13) |
| Browser, solo climb from an empty burner | `npm run test:ui` | onboarding, climb, cash out, 4 explorer proof links, 0 console errors |
| Browser, a GMEx climb | `MARKET=GMEx npm run test:ui` | GMEx card open in the lobby, climb at the GME price, cash out, 4 proof links, 0 console errors |
| Browser, leverage pack | `FLOW=pack npm run test:ui` | VRF draw, free climb capped at its tier, gain-only result, 0 console errors |
| Browser, wallet menu | `FLOW=menu npm run test:ui` | handle and session shown, handle renamed on chain, 0 console errors |
| UX tour (screenshots) | `node ops/test/ux-tour.mjs` | landing, lobby, wallet chooser and menu, closed markets (clock on a Saturday), mobile; 0 page errors |
| Simulation flows (`?mock`) | `npm run test:solo` etc. | the original Puppeteer flows of the front |

Bugs the tests found and how each was fixed: [FINDINGS.md](FINDINGS.md).

CI (GitHub Actions) runs the rules tests and the client checks on every pull request; `npm run ci` runs the same steps locally. CI stays off devnet so it is deterministic: the chain is covered by the battery and the browser flows above.

## Latencies (battery medians, devnet + devnet-eu)

| Step | Median |
|---|---|
| stake + delegate (Solana) | 1.0 s |
| delegation visible on the rollup | 17 ms |
| begin at the oracle price + schedule the crank (rollup) | 0.31 s |
| cash out + commit/undelegate (rollup) | 0.30 s |
| back on Solana after the cash out | 0.9 s |
| settle (Solana) | 1.03 s |
| pack VRF callback | 1.1 s |

## Known gaps

- **Delegation cost.** Each climb is one delegation, about 0.003 SOL of protocol fees on magicblock-core 2.0 (FINDINGS #4), paid by the session key. The front funds the session key in proportion to the wallet (up to about 60 climbs) and shows the fuel left in the wallet menu; keeping a player's run delegated between climbs would remove the cost and is left for after the hackathon.

## Repository

```
chain/programs/siroclimb/src/
  lib.rs     instructions (Solana and rollup), account contexts, price reading
  game.rs    climb, profile and pack rules, unit tests
  token.rs   minimal SPL token helpers (no anchor-spl: half the binary, half the rent)
js/chain/    isomorphic client (browser + node): config, PDAs, IDL builders, decoders,
             sending, session keys, wallets, handles, Climber
js/api.js    the front's contract; js/api-chain.js serves it from the chain,
             js/api-mock.js is the old simulation (?mock)
js/game.js   screens, HUD, leverage gauge, sound, scene driving
api/         serverless route: faucet
ops/         setup, probes, battery, keeper, dev server, browser tests
3d/, assets/ the Three.js scene sources, hero films, brand marks
```
