# Findings

Everything the probes, the batteries and the browser tests turned up, in the
order it was found, with what was done about it. Integration notes about
MagicBlock come first, then bugs.

## MagicBlock integration notes

1. **The devnet rollups run magicblock-core 2.0.4.** On 23 Nov 2026 devnet-eu, -as and -us all
   answered `getVersion` with core 2.0.4. The legacy `ScheduleTask` crank still works for
   instructions without signers: one task of 140 iterations at 500 ms ticks a whole climb
   (about 120 ticks in 60 s, checked on every battery climb that rode to the bell).
2. **Pick the closest rollup.** From Europe, devnet-eu answers in about 30 ms, devnet-as in
   about 160 ms; all three carry the same Pyth Lazer feeds. Delegations name the devnet-eu
   validator explicitly.
3. **The equity and metal feeds are on the rollups, FX is not.** TSLA (1435), NVDA (1314),
   AAPL (922) and XAU/USD (346) are fresh (under 1 s) on every devnet rollup. The xStock
   crypto feeds (AAPLX/NVDAX/TSLAX 1792/1833/1847) have no account there, GBP/USD (333) is
   frozen, Pyth's devnet push account for GBP/USD was 16 minutes old, and our Pyth key is
   entitled to equities and metals only. GBP/USD therefore comes from the program's own relay
   account.
4. **Each delegation costs about 0.003 SOL on 2.0.** The delegation record and metadata rent
   (2 × 1,559,040 lamports) paid by whoever delegates is not returned at undelegation:
   2.7 M lamports go to a fee account and 0.3 M to the validator, about 0.12 M come back. A
   climb is one delegation, so a session key topped up with 0.05 SOL plays about 15 climbs. The
   front now funds the session key in proportion to the wallet (up to 0.2 SOL, about 60 climbs),
   shows the fuel left in climbs in the wallet menu, and says why the wallet asks again when it
   runs out. Removing the cost itself means keeping a player's run delegated between climbs
   (commit without undelegating, settle from the committed state): a program redesign left for
   after the hackathon.
5. **Rollup transactions need no SOL at all.** The relay key and the practice players sign
   rollup transactions with an empty balance; only the base-layer steps (stake, delegate,
   settle) cost fees.
6. **One transaction from stake to the rollup.** `start_run` and `delegate_run` go in the same
   transaction; the delegated account is readable on the rollup about 0.1 s after it lands.
   `cash_out` both ends the climb and commits + undelegates, so a cashed-out climb is back on
   Solana well under a second later.
7. **Base-layer VRF is quick.** The round market callback lands about 0.6 s after the request,
   the pack callback about 1.5 s.
8. **Use MagicBlock's devnet RPC for bursts.** The public devnet RPC answered 429 while the
   setup created four round slots in a row.
9. **A session key can be the token spender.** Approving the session key as SPL delegate of the
   wallet's test USDC (in the onboarding transaction) lets it stake without any wallet prompt;
   the program still checks that the token account belongs to the player and the
   `SessionTokenV2` (authority, signer, program, expiry).

## Bugs

| # | Found by | Bug | Fix |
|---|---|---|---|
| 1 | devnet probe | Re-onboarding a wallet failed with `FaucetCooldown` (6006): onboarding always claimed the faucet | Claim only when the wallet holds under 100 tUSDC (PR #2) |
| 2 | browser e2e | The round lobby told a visitor with no wallet to "Get test tokens" (balance 0 before connecting), and the join button never appeared | "Join for 10 tUSDC" until connected (PR #4) |
| 3 | browser e2e | Headless Chrome has no wallet extension: the chooser was skipped and the test waited for it | The chooser only opens with more than one wallet; the test handles both (PR #4) |
| 4 | small battery | `delegate_round` before the bell on an empty round answered `BadStatus` (6011) instead of `TooEarly` (6015): the test expected the wrong code (program correct: an empty round is never delegated) | Test moved after the joins (battery PR) |
| 5 | small battery | With fewer than 8 players the round phase indexed players that did not exist (test bug) | Players picked modulo the field (battery PR) |
| 6 | full battery | A round slot stayed delegated after a client stopped between `delegate_round` and `go_live` (the small battery crashed there). Clients only looked at the current and previous round ids, so nobody moved it along, and every fourth round could not open (`open_round` answered 3007, account owned by the delegation program) | The front's autopilot and the keeper read all four slots every second and push any round they find along (late go live, finish, settle, record); a free slot is only reopened when the program would accept it (fix PR) |
| 7 | full battery | "Join after the bell" was refused with `RoundFull` instead of `TooLate`: devnet's clock runs 1 to 2 s behind the wall clock, so the late join still reached the seat check | The battery waits for the chain clock (block time) to pass the bell; the front stops offering the join 1.5 s before the bell (battery PR) |
| 8 | browser e2e (repeat runs) | Every test run starts from a new burner, so the site faucet's 5-per-hour IP limit refused the local test machine and the round test stopped at onboarding ("needs a little devnet SOL"); 0.08 SOL also left a burner unable to refuel its session key a second time | Loopback requests are not rate limited (dev server only), and the faucet sends 0.15 SOL: onboarding plus one later session top-up (fix PR) |
| 9 | manual check during gold's daily break | Pyth Lazer feeds keep publishing outside a market's sessions with the price frozen and a fresh timestamp, so "fresh feed = open" showed gold open during its 17:00 to 18:00 New York break (the same happens on stock holidays) | The front, the keeper and the battery check Pyth's published session schedules (America/New_York, holidays included) as well as freshness (`js/chain/hours.js`). The program enforces the same sessions since the 24 Nov upgrade (`MarketClosed`) |
| 10 | browser e2e (pack flow) | A pack climb that ended below its 10 tUSDC house stake showed "−0.03 tUSDC" on the result screen, although the program pays only the gain and the player loses nothing | The result of a pack climb reports the money won (never negative), the position's return stays in the stats (fix PR) |

## Notes added later

10. **Price history without a key.** Every update of a MagicBlock price account is a rollup transaction (`update_price_feed`, one per 50 to 200 ms), and the rollup answers batched `getTransaction` calls (60 in about 160 ms). The lobby and the in-game chart are seeded with the last 90 s of each market from those transactions, the same source as the live price (`js/chain/history.js`).
| 11 | UX tour (Puppeteer screenshots) | The round lobby said "Drawing this round's market…" for a round nobody had opened, and "A round is live" after its bell; with every market closed it still offered "Join for 10 tUSDC" | An unopened round and closed markets are told apart in plain words, no market is highlighted before the draw, the join button reads "Markets closed" (fix PR) |
| 12 | UX tour | The "Leverage pack" button showed before any wallet was connected (a `display` rule beat the `hidden` attribute), the top bar showed a "0.00 tUSDC" balance for a visitor, and GBP/USD showed as "1.30" (its moves are in the fourth decimal) | Hidden really hides, the balance reads "–" until a wallet connects, prices under 10 show four decimals (fix PR) |
| 13 | battery on the upgraded program | `record_round` with 10 profiles in one transaction ran out of the default 200k compute units (each profile is a PDA check, a deserialize, the record and a serialize: about 25k); the round stayed settled but unrecorded until a smaller batch went through. The same run also showed battery checks racing a browser's autopilot that settled and recorded the battery's rounds first | 6 profiles per transaction with a 400k compute limit (`Climber.recordRound`); the battery accepts a permissionless round step already taken by another client. Next run: 400 / 400 (fix PR) |
| 14 | review of the keys | The first program and its service keys (faucet, relay, keeper, house and battery players) had been deployed and funded with the Solana CLI default wallet, which belongs to another project | Everything redeployed from Siroclimb's own deployer with new keys (new program id, config, mint, vault, slots, relay, mirrors); scripts and Anchor refuse the CLI default wallet; the old program closed and its rent and the old keys' SOL returned to that wallet; old keys retired. Battery on the new deployment: 404 / 404 |
| 15 | market swap (GBP/USD out) | Amazon, Meta, Microsoft and Alphabet, the first picks for a fourth stock, have Pyth Lazer ids (954, 1272, 1292, 1163) but no MagicBlock price account on any devnet or mainnet rollup (nor do the AMZNX/METAX xStock feeds); the only other US equity feed on devnet-eu is GME (1160) | GMEx (GameStop xStock) at market index 4, read like the other stocks; the GBP/USD relay and its trusted key are gone |
| 16 | GMEx probe | `npm run probe`, documented in the README, had no script in package.json | Script added |
| 17 | round removal (solo only) | The four round slots could only be reused, never closed: their rent (0.056 SOL) would have stayed locked once the round instructions were gone, and two of them sat opened with nobody seated | `close_round_slot` (admin only) closes a free, settled or empty opened slot and returns its rent; a slot with players is refused (`SlotBusy`); covered in LiteSVM |
| 18 | battery on a tight deployer | Every battery run topped each player up to 0.075 SOL and each session key to 0.04 SOL whenever below 0.03, about 1.9 SOL for 24 players; it also overwrote BATTERY.md's run history | Top-up thresholds and amounts come from the environment (`BATTERY_FUND_*`, `BATTERY_SESSION_*`); a run replaces only the latest run section |
| 19 | reserve design | Run accounts are fixed-size and reused, so the reserve's new run fields would have made every existing run account unreadable to `start_run` (Anchor deserializes before the handler) | `grow_run` resizes an old run account (permissionless, the payer adds the rent) and the client puts it in the same transaction as the next climb; LiteSVM checks an old 168-byte account is refused, grown, then plays |
| 20 | reserve LiteSVM test | With the full 5M bankroll the utilization guard can never bind, so the first version of the test "passed" a refusal that could not happen | The test runs on a 200 tUSDC reserve: a 100 tUSDC climb (400 reserved) is refused with `ReserveFull`, a 40 tUSDC one starts, a lender cannot withdraw what an open climb reserved |
| 21 | reserve deploy | The upgrade made `start_run` require the reserve account, and the Vercel deploy right after it hung: the live front could not start climbs for about 15 minutes until a second deploy went through | Deploy the front immediately after an upgrade that changes instruction accounts, and check the live site serves the new files (`/js/chain/reserve.js`) before moving on |
| 22 | xStocks after hours | Climbs on TSLAx, NVDAx, AAPLx and GMEx barely moved outside US hours: Pyth's equity feeds on the rollup stay fresh but stop moving at the close, while the xStocks trade 24/7 | The four xStocks read program-owned relay accounts on the rollup, pushed every second from the xStock's own market (Kraken's xStock book, Jupiter for GMEx, cross-checked at 1.5 %); open 24/7, gold keeps its sessions |
| 23 | relay sources | Averaging Kraken and Jupiter, or switching between them when one did not answer, made prices jump by up to 1 % (a −30 % climb on GMEx in 9 s): Jupiter's price hops between routes and is often missing for a few seconds | One source per market, the other only as a sanity check; GMEx's Jupiter price eased in at most 0.15 % a second; a market whose source did not answer is not pushed |
| 24 | cash out | Twice in a day a cash out showed no result for 30 s and the next start failed: the rollup dropped the cash out, the client waited out its blockhash while the climb ran on, and a climb left on the rollup (or staked with a begin refused on a stale price) blocked the next `start_run` | A dropped cash out is resigned and resent at once (up to 4 times); `recover()` before every start and after a reload cashes out, refunds, commits again and settles whatever was left behind; begin retries a late relay price. 38 climbs since, cash out to result 2.2 to 3.1 s |
| 25 | first load | With nobody on the site the relay stopped and the first visitor saw the stocks "Closed" | A Vercel cron keeps the relay pushing every second; a market waking up shows "Live price…" instead of "Closed" while the page pushes at once |
| 26 | intro | The pre-rendered intro film showed the old coin for about a second before the live scene took over | The live scene starts first and draws the current coin about 0.4 s after load; the film is only the no-WebGL fallback |
| 27 | production health check, 25 Nov | 12 climbs on production, long and short, stakes 10 to 100, 1x to 4x, borrowing from the Reserve at 1.5x and up: all cashed out, results in 2.6 to 5.4 s, borrow costs as expected. The site faucet was empty again (0.15 SOL left, one 0.15 SOL grant short of its fee), so new burners fell back to devnet airdrops | Faucet refilled with 1 SOL from the deployer; it now gives what is left rather than failing, 503 when empty |
| 28 | mobile 390 px | The top bar overflowed: the wallet address was cut at the right edge | Narrower icons and a four-character address on phones |
| 29 | Vercel DDoS mitigation | Around 13:00 UTC on 25 Nov, Vercel's automatic DDoS mitigation started challenging every request to siroclimb.sirocco.finance (`x-vercel-mitigated: challenge`, 600 requests denied or challenged), probably set off by the test batteries' headless browsers. Real browsers pass the JavaScript check, but headless tests, link previews (the X card crawler) and plain HTTP clients get a 403; `siroclimb-magicblock.vercel.app` is not affected, and the relay cron kept running | Lifted on its own about two hours later; checked afterwards: the share page and card answer 200 to Twitterbot with the summary_large_image card. Long test batteries now run against the vercel.app domain so they do not trip it again |
| 30 | real positions | The desk and positions grew the program from 534 KB to 637 KB, past its 577 KB program data account, and the upgrade buffer (3.24 SOL) plus the extension (0.33 SOL) was more than the deployer held; devnet airdrops were rate-limited | Swept the idle battery players' and session keys' SOL back to the deployer (1.36 SOL), extended the program data by 64 KiB, borrowed 0.5 SOL from the site faucet for the buffer and returned it after the upgrade |
| 31 | real positions | Positions open on Solana but the relay's prices live on the rollup (delegated accounts), so Solana had no fresh price to fill at | The relay also pushes its prices to a Solana `Quotes` account about every 10 s (route, cron, keeper); an opening fill needs a quote at most 30 s old (`StalePrice` otherwise), the step fills use the rollup's tick price |
| 32 | real positions | A climb in flight during the upgrade has a run account of the old size, which `settle_run` cannot read | The client grows the run account in the settle transaction (`grow_run` + `settle_run`); a run without a position skips the close |
| 33 | user report, 25 Nov: "stays on Starting…" | Two players' run accounts had been left on the rollup for hours (staked on Solana, expired on the rollup, never committed back), one of them the reporter's wallet. They were 200 bytes, the layout from before the reserve; after the positions upgrade the program could no longer read them as a `Run`, so every `finish_run` the front's recovery sent failed (`AccountDidNotDeserialize` 3003, seen in the rollup's history) and the start waited out its 90 s recovery | `rescue_run` (permissionless) reads the old fixed prefix, refunds a climb that never began or expires one past the bell, and commits and undelegates it; the front's recovery uses it for an older layout, then grows and settles the run. Both runs rescued and settled on devnet (the reporter got 92.77 tUSDC back). The start now gives up recovery after 80 s with a clear message, and checks that the Solana price is fresh before staking (asking the relay if not). 12 starts in a row on production from a fresh wallet: 6.1 s with onboarding, then 1.6 to 2.0 s |
| 34 | the fix's upgrade | The upgrade buffer for the 647 KB program (3.29 SOL) was more than every Siroclimb key held together (2.93 SOL); devnet airdrops still rate-limited | The one-time setup instructions (initialize, init_reserve, init_relay, delegate_relay, init_desk, set_desk, fund_house, close_round_slot), all already run, were removed: 559 KB, a 2.84 SOL buffer. The LiteSVM tests now write the state those instructions wrote; a new deployment needs the program from before their removal |
| 35 | setup path | The setup instructions removed in #34 left main unable to set up a fresh deployment | With devnet SOL from the user (20 SOL to the deployer), they are back (initialize, init_reserve, init_relay, delegate_relay, init_desk, set_desk, fund_house, close_round_slot): program data extended by another 64 KiB (708,608 bytes), the program upgraded in place with no change to any account or instruction in use; the LiteSVM tests call the real instructions again, `ops/setup.mjs` runs the whole setup including the desk. Checked on devnet that each answers (simulated: init_reserve refuses an existing reserve, close_round_slot refuses a slot that is not a round) |

