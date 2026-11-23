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
   climb is one delegation, so a session key topped up with 0.05 SOL plays about 15 climbs; the
   front tops it up again from the wallet when it runs low (`ensureFuel`).
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
| 9 | manual check during gold's daily break | Pyth Lazer feeds keep publishing outside a market's sessions with the price frozen and a fresh timestamp, so "fresh feed = open" showed gold open during its 17:00 to 18:00 New York break (the same happens on stock holidays) | The front, the keeper and the battery check Pyth's published session schedules (America/New_York, holidays included) as well as freshness (`js/chain/hours.js`). The program itself only checks freshness: see Known gaps in the README |
