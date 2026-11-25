# Siroclimb on MagicBlock

**A one-minute leverage climb on tokenized stocks and gold, played on an Ephemeral Rollup and settled on Solana.**

Pick a market (TSLAx, NVDAx, AAPLx, GMEx or gold), go long or short: the coin rolls up and down a staircase that follows the live price, leverage climbs from 1x to 4x every 6 seconds over a 60 second climb, and you cash out whenever you like. Your stake is the most you can lose. Leverage is a real loan: past 1x the rest of the position is borrowed from the **Sirocco Reserve**, a tUSDC lending pool anyone can lend to.

Built for MagicBlock's Solana Blitz v10 (Entertainment Finance). Everything runs on **Solana devnet + MagicBlock's devnet Ephemeral Rollup**. The xStocks trade around the clock and so does the game: their live 24/7 market price is relayed into the rollup; gold reads MagicBlock's Pyth Lazer feed.

## Why MagicBlock

A climb is a minute of a position that changes every half second: the price moves, the leverage steps up every 6 seconds, the coin can fall at any tick, and the player can cash out at any instant. On Solana alone that is 120 paid transactions per climb, a wallet prompt per action and 400 ms slots between a click and its effect. On an Ephemeral Rollup the whole minute runs on chain, ticked by the rollup's own crank against MagicBlock's real-time Pyth prices, at zero fee and with 10 ms blocks, while the money (stakes, vault, payouts) never leaves Solana. Session keys remove the last friction: one approval, then every action is instant.

## How a climb runs

```
 Solana devnet (base layer)                      MagicBlock Ephemeral Rollup (devnet-eu)
 ──────────────────────────                      ───────────────────────────────────────
 onboarding, ONE wallet approval:
   profile + 1,000 tUSDC + session key
   (create_session_v2) + spending allowance
 start_run ─ stake to the vault, the Sirocco
   Reserve sets liquidity aside for the climb
   + delegate_run (signed by the session key) ──▶ begin_run   entry = live Pyth Lazer price,
                                                              ScheduleTask: tick_run every 500 ms
                                                 tick_run ×120  crank, on chain, free:
                                                              leverage step, value, bust, bell
                                                 cash_out    (session key, no fee) last step at the
                                                              live price + commit_and_undelegate
 settle_run ◀────────────────────────────────────
   pays the position less the borrow cost, releases the reservation,
   writes the profile (bests, history)
```

Timed rounds (everyone on the same market, a pot split 50 / 30 / 20) were removed on 24 Nov 2026 to keep the game solo; their four slot accounts were closed with `close_round_slot` and their rent returned (see [DEPLOYMENTS.md](DEPLOYMENTS.md)).

## The Sirocco Reserve: real leverage, lent by lenders

Leverage in Siroclimb is a loan from a pool, not a bet against a house.

- **The position.** A player stakes S. At leverage L the position is **S x L**: the stake plus **S x (L - 1) borrowed from the reserve**. The ladder steps from 1x to 4x every 6 s, so a climb borrows nothing at 1x, S/2 at 1.5x, up to 3 x S at 4x. The amount borrowed right now is on chain (`Run.borrowed`, updated on every tick on the rollup) and next to the leverage in the HUD.
- **The loan's cost.** A 0.1 % fee on the most the climb borrowed plus interest at **36.5 % APR** on what it borrowed each second, taken from the position at settlement and kept by the reserve (`borrow_cost`, the same function in the program and in the front; the result screen shows it). On a one-minute climb the fee is most of it: 25 tUSDC taken to 4x pays 0.075 tUSDC of fee and 0.00003 of interest.
- **No liquidation, stake-capped loss.** The position's value follows the price at the climb's leverage (the game's boost and ladder, unchanged). It is floored at zero: a player can lose the stake and never more, and **the reserve absorbs any shortfall past it** (a margin loan without liquidation). It is capped at **5 x the stake**, the most the reserve can ever owe on a climb.
- **Lenders.** Anyone `deposit`s tUSDC and receives shares; a share is worth the reserve's assets (the vault minus the stakes of climbs in flight) over its shares, so **borrow fees, the stakes of losing climbs and the gains of winning ones all accrue to lenders**. `withdraw` redeems shares at that price. The deployer is the first lender: `init_reserve` turned the 5,000,000 tUSDC house bankroll into its position.
- **Utilization guard.** A climb starts only if the reserve's free liquidity (assets minus what open climbs reserved) covers the most it could owe beyond its stake, **4 x S**, which is more than its largest borrow, 3 x S (`ReserveFull` otherwise). That amount and the climb's borrow line are recorded on chain (`Reserve.reserved`, `Reserve.lines`) until it settles, and lenders cannot withdraw them meanwhile (`NotEnoughLiquidity`).
- **Leverage packs** are funded by the reserve: the free 10 tUSDC climb is the reserve's money (its whole position is borrowed), the player keeps only the gain, and there is no borrow cost. It is the lenders' marketing budget, one pack per player per 10 minutes, at most 40 tUSDC each.
- **Reserve panel** (bank icon in the top bar): TVL, utilization, borrow lines open, share price, lender APY since the reserve opened, the borrow rate, your position, deposit and withdraw.

Rounds (player-versus-player pots, no borrowing) were removed before the reserve, so every climb that borrows is a solo climb.

## MagicBlock features used

| Feature | Where | What it does here |
|---|---|---|
| **Ephemeral Rollups** | `delegate_run`, `cash_out`, `finish_run` | The `Run` account is delegated for the minute of play. Price ticks, leverage steps, the bust and every cash out run on the rollup at zero fee; the cash out itself commits and undelegates. Money never leaves Solana. |
| **Cranks** (`ScheduleTask`) | `begin_run` → `tick_run` | The climb ticks itself every 500 ms on the rollup (about 120 ticks per climb). No off-chain ticking loop. Ticks are permissionless and idempotent. |
| **Real-time price oracle** | `begin_run`, `tick_run`, `cash_out`, `finish_run` | Gold reads MagicBlock's Pyth Lazer XAU/USD feed on the rollup (`PriCems5…`, 346). The xStocks read the program's relay accounts on the rollup (below). Addresses pinned per market, owner checked, staleness bound: a stale price holds the climb still and blocks new climbs (market closed). |
| **VRF** | `open_pack` → `apply_pack` | The tier of every leverage pack is drawn by MagicBlock's VRF; callbacks are only accepted from the VRF program's scoped identity. |
| **Session keys** (`session-keys`, `SessionTokenV2`) | `start_run`, `open_pack`, every rollup action | The wallet approves once. A browser-held session key, authorised by a `SessionTokenV2` and approved as SPL spender of the wallet's test USDC, signs every stake, cash out and pack with no wallet prompt (wallets cannot sign rollup transactions anyway). |

### Markets and prices

| Market | Price | When it moves |
|---|---|---|
| TSLAx, NVDAx, AAPLx | the xStock's own market, around the clock: mid of Kraken's xStock book (TSLAx/USD, NVDAx/USD, AAPLx/USD), relayed into the rollup | 24/7 |
| GMEx | Jupiter's price of the GMEx mint on Solana (its Kraken book is thin and wide), eased in at most 0.15 % a second, relayed into the rollup | 24/7 |
| Gold (XAU/USD) | MagicBlock's Pyth Lazer metal feed on the rollup | Sun 18:00 to Fri 17:00 New York, with a daily hour off |

**Why a relay.** The xStocks are tokens that trade around the clock, nights and weekends. Pyth's US equity feeds, which MagicBlock pushes into the rollups, stand still outside US hours (checked 24 Nov 2026, 18:30 New York: TSLA, NVDA, AAPL, GME fresh but frozen), and MagicBlock's rollups carry none of Pyth's 24/7 xStock feeds for these four (`Crypto.TSLAX/USD` 1847, `NVDAX` 1833, `AAPLX` 1792; `GMEX` 3387 is not live yet; only SPYX is on the rollup), and Pyth's Hermes API refuses keyless reads. So the program keeps one relay account per xStock on the rollup (`["relay", asset]`, `init_relay`, `delegate_relay`), and only the relay key named at init can `push_price` into it (gasless on the rollup; prices may not go back in time or come from the future). `/api/relay` pushes all four in one rollup transaction, at most about once a second, whenever a browser has the game open (the page asks every second), and the optional keeper does the same. Each push reads both venues: the market's own source, and the other one as a sanity check (a price more than 1.5 % away from Jupiter, or a Jupiter price outside Kraken's bid-ask range by 1.5 %, is not pushed). A relay that stops ages like any feed: past `MAX_PRICE_AGE` (10 s) the program holds a live climb still and refuses new ones. Swapping the source for signed Pyth updates is one function in `js/chain/relay.js`.

Gold shows **closed** in the lobby outside its sessions: the front checks Pyth's published schedule (New York time, holidays included) as well as the price's freshness, because Pyth keeps publishing a frozen price with a fresh timestamp while a market is closed, and the program enforces the same sessions on chain (`hours.rs`, tested against the front's answers on 3,000 instants and in LiteSVM with the clock set to a Saturday, Thanksgiving and a Friday bell): no stake and no start outside a session (`MarketClosed`). The xStocks are open all week (`KIND_ALWAYS`); LiteSVM plays TSLAx and GMEx climbs on a Saturday and refuses a climb on a relay price a minute old (`StalePrice`).

The charts open full: the last 90 seconds of each market are read back from its price account's update transactions on the rollup (keyless, same source as the live price; `js/chain/history.js`).

Real minute-scale moves are tiny (Tesla moves about 0.07 % in three minutes after hours), so each market's move is **boosted** before leverage applies (TSLAx 90, NVDAx 25, AAPLx 90, gold 180, GMEx 55). Measured on the 24/7 sources at night (24 Nov 2026, 19:00 New York): the xStocks move about 1 bp a second in a few ticks a minute, so a minute's climb still swings by several percent at 1.5x. A boost is a game rule, stated in the rules sheet.

The xStocks have no devnet mints, so devnet mirrors were created with the same name, symbol and decimals (Token-2022, 8 decimals); see [DEPLOYMENTS.md](DEPLOYMENTS.md).

## What lives where

| | Solana (base) | Ephemeral Rollup | Off-chain |
|---|---|---|---|
| Sirocco test USDC (tUSDC), faucet, vault, payouts | ✓ | | |
| Stakes, Sirocco Reserve (shares, reserved liquidity, borrow lines, lender positions) | ✓ | | |
| Session authorisation (`SessionTokenV2`) and spending allowance | ✓ | | |
| Live climbs: entry price, ticks, leverage, amount borrowed, bust, cash out | | ✓ | |
| Prices (Pyth Lazer pushed by MagicBlock) | | ✓ | |
| Profiles: handle, record, bests, last 8 climbs, pack | ✓ | | |
| VRF draws: leverage packs | ✓ | | |
| Leaderboards (today, all time) | read | | front |
| Climb autopilot: finish and settle a climb left behind | ✓ | ✓ | any browser (permissionless) |

**Wallet state in sight.** The wallet menu shows the on-chain handle (renamable), until when the game session key is valid and how many climbs its fuel still pays for; the balance reads "–" until a wallet connects; errors are short sentences ("This market is outside its trading hours, pick another one"), never raw transaction errors.

**Serverless.** No server has to run for the game to work: every step of a climb is permissionless and the page itself pushes each one along (autopilot), and the xStock prices are relayed by `/api/relay` while a browser has the game open. The optional keeper (`npm run keeper`) relays all the time and sweeps climbs left on the rollup by closed tabs. The serverless routes are a devnet SOL faucet for new wallets and the share cards below.

**Share on X.** After a climb, Share opens X with a link like `https://siroclimb.sirocco.finance/s/<token>`. `/api/share` reads the player's run account (settled, back on Solana) and the matching record of their profile, and signs that result with a server secret; the `/s/` page carries `twitter:card = summary_large_image` and an `og:image` drawn by `/api/card` (1200 x 630 PNG: the coin, the result, return, top leverage, stake, time, market and side; SVG + Inter rendered by resvg). A card cannot claim a climb nobody played, and a changed token is refused. **Save image** downloads the in-game picture of the end of the climb. People who open the link land on the game.

## Leverage packs

Every 10 minutes a player can open a free pack: MagicBlock's VRF draws a tier (Bronze 1.5x 45 %, Silver 2x 28 %, Gold 3x 18 %, Diamond 4x 9 %) and the pack is a 10 tUSDC climb on the Sirocco Reserve's money whose ladder tops out at that tier. The player keeps the gain, the reserve eats the loss.

## Deployed (devnet)

| | Address |
|---|---|
| Program | [`BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ`](https://explorer.solana.com/address/BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ?cluster=devnet) |
| Rollup | `https://devnet-eu.magicblock.app` (validator `MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e`, magicblock-core 2.0.4) |

Every account, mint and explorer link: [DEPLOYMENTS.md](DEPLOYMENTS.md). Each climb's result screen links every transaction of that climb (Solana and rollup) to the explorer.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:3042: the site + /api/faucet, /api/share, /api/card, /s/<token>
```

Open the page, **Start playing**, pick an open market and **Start climbing**. Connect Phantom / Solflare / Backpack on devnet, or the built-in **burner wallet** (devnet SOL comes from the site's faucet). The first climb asks for one approval; every later action is instant. `?mock` runs the old in-browser simulation, no chain. `#play` opens the lobby directly.

### Hosting (Vercel, live at https://siroclimb.sirocco.finance)

The site is static (no build step: `index.html`, `play.css`, `js/`, `assets/`); `api/*.js` are Vercel Node functions (`vercel.json` rewrites `/s/<token>` to `api/s.js` and bundles the card fonts). Import the repo in Vercel with no framework preset and set the server-side environment variables:

| Variable | What |
|---|---|
| `FAUCET_SECRET_KEY` | JSON array of a funded devnet keypair (`~/.config/siroclimb/solana/faucet.json`) |
| `RELAYER_SECRET_KEY` | JSON array of the relay keypair (`~/.config/siroclimb/solana/relayer.json`), the only key that can push xStock prices |
| `SHARE_SECRET` | random string that signs share links (`~/.config/siroclimb/solana/share-secret.txt` for the dev server) |

Without them the game still works: new wallets need devnet SOL from faucet.solana.com, and Share falls back to the share sheet or the clipboard.

### Ops scripts (keys in `~/.config/siroclimb/solana/`, never in the repo)

Every script signs with Siroclimb's own deployer (`~/.config/siroclimb/solana/deployer.json`, or `SIROCLIMB_DEPLOYER`) and refuses the Solana CLI default wallet; `npm run chain:deploy` names it as payer and upgrade authority, `npm run mirrors` creates the xStock mirrors with it.

| Command | |
|---|---|
| `npm run chain:build` | `anchor build` in `chain/` |
| `npm run chain:test` | Rust unit tests of the game rules |
| `npm run setup` | one-time, idempotent: mint, vault, config, the bankroll and the Sirocco Reserve opened on it |
| `npm run probe` | one session-keyed climb through the rollup, step by step (`ASSET=4` for GMEx) |
| `npm run battery -- 24 2` | on-chain battery: lenders, solo waves on the reserve, refusals, packs ([BATTERY.md](BATTERY.md)) |
| `npm run test:ui` | the real front in headless Chrome (`FLOW=pack`, `menu`, `reserve`; `MARKET=GMEx` picks the market; `FRESH=1` from an empty burner) |
| `npm run ci` | every CI step, locally |
| `npm run test:hours` | the on-chain market hours in LiteSVM (after `npm run chain:build`) |
| `npm run test:reserve` | the Sirocco Reserve in LiteSVM: shares, the guard, borrow cost, `grow_run` |
| `npm run keeper` | optional keeper: sweeps climbs left behind |

## Tests and results

| Suite | Command | Result |
|---|---|---|
| Game rules and sessions (Rust unit) | `npm run chain:test` | 17 / 17 (ladder, payout cap, borrow cost, share math), including 3,000 instants matched against the front's schedule reader |
| Market hours, 24/7 xStocks and retired round slots on the built program (LiteSVM) | `npm run test:hours` | 25 / 25 |
| Sirocco Reserve on the built program (LiteSVM) | `npm run test:reserve` | 24 / 24: the bankroll becomes the admin's shares, deposit and withdraw at the share price, 4 x stake reserved and a 3 x stake line per climb, `ReserveFull`, `NotEnoughLiquidity`, `BadShares`, settlement charges exactly the front's borrow cost, lenders' positions move with the climb, `grow_run` on an old run account |
| On-chain battery | `npm run battery -- 24 2` | with the Sirocco Reserve (`-- 8 1`): **156 / 156**: 3 lenders deposit and withdraw at the share price, 8 simultaneous climbs on all five markets each checked for its reservation, borrow line and borrow cost, refusals, VRF packs, the reserve square at the end; solo only before it: 118 / 118; earlier, with rounds: **404 / 404** (48 simultaneous climbs by 24 session-keyed players, two full 24-seat rounds drawn by VRF) and **132 / 132** after the GMEx upgrade ([BATTERY.md](BATTERY.md); earlier runs found FINDINGS #6, #7, #13) |
| Browser, solo climb from an empty burner | `npm run test:ui` | onboarding, climb, cash out, 4 explorer proof links, Share opens X with a signed `/s/` link (summary_large_image, card PNG 200), 0 console errors |
| Browser, a GMEx climb | `MARKET=GMEx npm run test:ui` | GMEx card open in the lobby, climb at the GME price, cash out, 4 proof links, 0 console errors |
| Browser, leverage pack | `FLOW=pack npm run test:ui` | VRF draw, free climb capped at its tier, gain-only result, 0 console errors |
| Browser, wallet menu | `FLOW=menu npm run test:ui` | handle and session shown, handle renamed on chain, 0 console errors |
| Browser, Sirocco Reserve | `FLOW=reserve npm run test:ui` | Reserve panel stats, 25 tUSDC lent, everything withdrawn, 0 console errors; the solo flow shows "Borrowed 12.50 tUSDC from the Sirocco Reserve" at 1.5x and the borrow cost on the result |
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
  reserve.rs the Sirocco Reserve: shares, exposure, borrow lines, borrow cost, unit tests
  hours.rs   gold's sessions (and US equity hours), New York time; the xStocks are 24/7
  token.rs   minimal SPL token helpers (no anchor-spl: half the binary, half the rent)
js/chain/    isomorphic client (browser + node): config, PDAs, IDL builders, decoders,
             sending, session keys, wallets, handles, the reserve's math, Climber
js/api.js    the front's contract; js/api-chain.js serves it from the chain,
             js/api-mock.js is the old simulation (?mock)
js/game.js   screens, HUD, leverage gauge, sound, scene driving, share
api/         serverless routes: faucet, share link, share card picture and page
ops/         setup, probes, battery, keeper, dev server, browser tests
3d/, assets/ the Three.js scene sources, hero films, brand marks
```
