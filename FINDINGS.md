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
