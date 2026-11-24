# Battery report

On-chain battery on Solana devnet + MagicBlock devnet-eu (`npm run battery -- 24 2 2`): 24 players with realistic handles, each with its own MagicBlock session key, playing at the same time.

| Run | Program | What | Checks |
|---|---|---|---|
| C, 24 Nov 2026 | with on-chain market hours | 48 simultaneous solo climbs, refusals, two full 24-seat rounds (AAPLx, NVDAx drawn by VRF), VRF packs and their free climbs | **400 / 400** |
| B, 23 Nov 2026 | first RWA build | two full 24-seat rounds | 66 / 67 (FINDINGS #7, test bug) |
| A, 23 Nov 2026 | first RWA build | 48 simultaneous solo climbs, packs | 338 / 342 (FINDINGS #6, stuck round slot) |

Between B and C a third run (399 / 408) found FINDINGS #13: `record_round` ran out of compute with 10 profiles per transaction. Runs A and B are in the git history of this file.

## Run C

Run 2026-11-24T08:45:29.433Z · program `29sucV8aHGufy1AWrKzgp9gBPRHBG9jSxAsSWXe7M2ov` · rollup https://devnet-eu.magicblock.app · 24 players · 2 solo waves · 2 rounds · 472 s

**400 / 400 checks passed.** Admin SOL 12.3429 -> 12.3429 (funding players).

Solo climbs settled: 48 (40 cashed, 8 expired), top leverage reached 4x.

Players (handles on chain): saffron301, dune.sol, ghibli_hunter, gecko_fx, bora.sol, wolfx, marrakechdesk77, bora_hands, amber625, rider88, lynx88, yield586, carrytrader.sol, gold.sol, sterlingrunner, yield935, basalt.sol, delta385, ember_fox, runner, quant24, atlas_pilot, deltawhale, copper_fox.

### Latencies

| step | n | median ms | max ms |
|---|---|---|---|
| stake + delegate (Solana) | 54 | 998 | 1308 |
| delegation visible on the rollup | 54 | 17 | 244 |
| begin + crank (rollup) | 54 | 306 | 452 |
| cash out + commit/undelegate (rollup) | 45 | 302 | 382 |
| undelegation back on Solana | 54 | 899 | 1214 |
| settle (Solana) | 54 | 1030 | 1315 |
| finish by a stranger (rollup) | 9 | 304 | 347 |
| open round + VRF request (Solana) | 2 | 1020 | 1020 |
| round market VRF callback | 2 | 685 | 685 |
| join (Solana) | 48 | 991 | 1326 |
| delegate round (Solana) | 2 | 3138 | 3138 |
| go live + crank (rollup) | 2 | 410 | 410 |
| round cash out (rollup) | 37 | 309 | 392 |
| finish round + commit/undelegate (rollup) | 2 | 387 | 387 |
| round back on Solana | 2 | 1079 | 1079 |
| settle round (Solana) | 2 | 1290 | 1290 |
| record profiles (6 per tx) | 2 | 4098 | 4098 |
| open pack + VRF request (Solana) | 6 | 1308 | 1312 |
| pack VRF callback | 6 | 698 | 707 |

### Checks

- PASS [ember_fox solo 1] live at the oracle price — status 2
- PASS [carrytrader.sol solo 1] live at the oracle price — status 2
- PASS [copper_fox solo 1] live at the oracle price — status 2
- PASS [bora.sol solo 1] live at the oracle price — status 2
- PASS [gecko_fx solo 1] live at the oracle price — status 2
- PASS [bora_hands solo 1] live at the oracle price — status 2
- PASS [saffron301 solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [yield935 solo 1] live at the oracle price — status 2
- PASS [wolfx solo 1] live at the oracle price — status 2
- PASS [gold.sol solo 1] live at the oracle price — status 2
- PASS [deltawhale solo 1] live at the oracle price — status 2
- PASS [marrakechdesk77 solo 1] live at the oracle price — status 2
- PASS [dune.sol solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [sterlingrunner solo 1] live at the oracle price — status 2
- PASS [saffron301 solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [runner solo 1] live at the oracle price — status 2
- PASS [amber625 solo 1] live at the oracle price — status 2
- PASS [yield586 solo 1] live at the oracle price — status 2
- PASS [basalt.sol solo 1] live at the oracle price — status 2
- PASS [lynx88 solo 1] live at the oracle price — status 2
- PASS [delta385 solo 1] live at the oracle price — status 2
- PASS [ghibli_hunter solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [quant24 solo 1] live at the oracle price — status 2
- PASS [atlas_pilot solo 1] live at the oracle price — status 2
- PASS [rider88 solo 1] live at the oracle price — status 2
- PASS [dune.sol solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [saffron301 solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [ghibli_hunter solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [dune.sol solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [saffron301 solo 1] live at the oracle price — status 2
- PASS [dune.sol solo 1] live at the oracle price — status 2
- PASS [saffron301 solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [ghibli_hunter solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [dune.sol solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [saffron301 solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ember_fox solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [carrytrader.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [copper_fox solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gecko_fx solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora_hands solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ghibli_hunter solo 1] live at the oracle price — status 2
- PASS [dune.sol solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield935 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ghibli_hunter solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [wolfx solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gold.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [deltawhale solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [marrakechdesk77 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ghibli_hunter solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [sterlingrunner solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [runner solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [amber625 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [yield586 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [basalt.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx88 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [delta385 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [quant24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [atlas_pilot solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [rider88 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora.sol solo 1] state committed to Solana equals the rollup — 49507612/49507612
- PASS [amber625 solo 1] state committed to Solana equals the rollup — 9884608/9884608
- PASS [bora.sol solo 1] payout = position (pack: the gain only) — paid 49.507612 delta -0.492388
- PASS [sterlingrunner solo 1] state committed to Solana equals the rollup — 50000000/50000000
- PASS [bora.sol solo 1] profile records the climb — runs 10->11
- PASS [saffron301 solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [dune.sol solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [bora.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [amber625 solo 1] payout = position (pack: the gain only) — paid 9.884608 delta -0.115392
- PASS [ghibli_hunter solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [amber625 solo 1] profile records the climb — runs 7->8
- PASS [sterlingrunner solo 1] payout = position (pack: the gain only) — paid 50 delta 0
- PASS [sterlingrunner solo 1] profile records the climb — runs 7->8
- PASS [marrakechdesk77 solo 1] state committed to Solana equals the rollup — 22711045/22711045
- PASS [amber625 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [sterlingrunner solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [deltawhale solo 1] state committed to Solana equals the rollup — 9897538/9897538
- PASS [marrakechdesk77 solo 1] payout = position (pack: the gain only) — paid 22.711045 delta -2.288955
- PASS [marrakechdesk77 solo 1] profile records the climb — runs 8->9
- PASS [deltawhale solo 1] payout = position (pack: the gain only) — paid 9.897538 delta -0.102462
- PASS [deltawhale solo 1] profile records the climb — runs 7->8
- PASS [marrakechdesk77 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [deltawhale solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield586 solo 1] state committed to Solana equals the rollup — 9992729/9992729
- PASS [wolfx solo 1] state committed to Solana equals the rollup — 101157359/101157359
- PASS [yield586 solo 1] payout = position (pack: the gain only) — paid 9.992729 delta -0.007271
- PASS [yield586 solo 1] profile records the climb — runs 7->8
- PASS [wolfx solo 1] payout = position (pack: the gain only) — paid 101.157359 delta 1.157359
- PASS [wolfx solo 1] profile records the climb — runs 9->10
- PASS [rider88 solo 1] state committed to Solana equals the rollup — 24743249/24743249
- PASS [yield586 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [wolfx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [atlas_pilot solo 1] state committed to Solana equals the rollup — 48471231/48471231
- PASS [rider88 solo 1] payout = position (pack: the gain only) — paid 24.743249 delta -0.256751
- PASS [rider88 solo 1] profile records the climb — runs 7->8
- PASS [atlas_pilot solo 1] payout = position (pack: the gain only) — paid 48.471231 delta -1.528769
- PASS [atlas_pilot solo 1] profile records the climb — runs 7->8
- PASS [rider88 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [atlas_pilot solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ghibli_hunter solo 1] state committed to Solana equals the rollup — 10168052/10168052
- PASS [lynx88 solo 1] state committed to Solana equals the rollup — 9930203/9930203
- PASS [basalt.sol solo 1] state committed to Solana equals the rollup — 99060677/99060677
- PASS [quant24 solo 1] state committed to Solana equals the rollup — 96348010/96348010
- PASS [ghibli_hunter solo 1] payout = position (pack: the gain only) — paid 10.168052 delta 0.168052
- PASS [ghibli_hunter solo 1] profile records the climb — runs 13->14
- PASS [yield935 solo 1] state committed to Solana equals the rollup — 51772281/51772281
- PASS [basalt.sol solo 1] payout = position (pack: the gain only) — paid 99.060677 delta -0.939323
- PASS [lynx88 solo 1] payout = position (pack: the gain only) — paid 9.930203 delta -0.069797
- PASS [basalt.sol solo 1] profile records the climb — runs 8->9
- PASS [lynx88 solo 1] profile records the climb — runs 8->9
- PASS [ghibli_hunter solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [delta385 solo 1] state committed to Solana equals the rollup — 96928595/96928595
- PASS [basalt.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [quant24 solo 1] payout = position (pack: the gain only) — paid 96.34801 delta -3.65199
- PASS [quant24 solo 1] profile records the climb — runs 8->9
- PASS [lynx88 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield935 solo 1] payout = position (pack: the gain only) — paid 51.772281 delta 1.772281
- PASS [yield935 solo 1] profile records the climb — runs 7->8
- PASS [dune.sol solo 1] state committed to Solana equals the rollup — 9882539/9882539
- PASS [quant24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield935 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [delta385 solo 1] payout = position (pack: the gain only) — paid 96.928595 delta -3.071405
- PASS [delta385 solo 1] profile records the climb — runs 7->8
- PASS [bora_hands solo 1] state committed to Solana equals the rollup — 22196986/22196986
- PASS [copper_fox solo 1] state committed to Solana equals the rollup — 98975370/98975370
- PASS [dune.sol solo 1] payout = position (pack: the gain only) — paid 9.882539 delta -0.117461
- PASS [dune.sol solo 1] profile records the climb — runs 12->13
- PASS [delta385 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [carrytrader.sol solo 1] state committed to Solana equals the rollup — 110207865/110207865
- PASS [bora_hands solo 1] payout = position (pack: the gain only) — paid 22.196986 delta -2.803014
- PASS [bora_hands solo 1] profile records the climb — runs 8->9
- PASS [copper_fox solo 1] payout = position (pack: the gain only) — paid 98.97537 delta -1.02463
- PASS [copper_fox solo 1] profile records the climb — runs 8->9
- PASS [dune.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [runner solo 1] state committed to Solana equals the rollup — 43037458/43037458
- PASS [copper_fox solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora_hands solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [carrytrader.sol solo 1] payout = position (pack: the gain only) — paid 110.207865 delta 10.207865
- PASS [carrytrader.sol solo 1] profile records the climb — runs 7->8
- PASS [runner solo 1] payout = position (pack: the gain only) — paid 43.037458 delta -6.962542
- PASS [carrytrader.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [runner solo 1] profile records the climb — runs 8->9
- PASS [runner solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ember_fox solo 1] state committed to Solana equals the rollup — 98972596/98972596
- PASS [ember_fox solo 1] payout = position (pack: the gain only) — paid 98.972596 delta -1.027404
- PASS [ember_fox solo 1] profile records the climb — runs 7->8
- PASS [ember_fox solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [saffron301 solo 1] state committed to Solana equals the rollup — 115543412/115543412
- PASS [saffron301 solo 1] payout = position (pack: the gain only) — paid 115.543412 delta 15.543412
- PASS [saffron301 solo 1] profile records the climb — runs 13->14
- PASS [saffron301 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gecko_fx solo 1] expired by the crank at 60 s — status 5, 119 ticks
- PASS [gecko_fx solo 1] crank ticked ~2/s for the whole climb — 119 ticks
- PASS [gecko_fx solo 1] state committed to Solana equals the rollup — 109351499/109351499
- PASS [gold.sol solo 1] expired by the crank at 60 s — status 5, 121 ticks
- PASS [gold.sol solo 1] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [gecko_fx solo 1] payout = position (pack: the gain only) — paid 109.351499 delta 9.351499
- PASS [gecko_fx solo 1] profile records the climb — runs 12->13
- PASS [gold.sol solo 1] state committed to Solana equals the rollup — 53002662/53002662
- PASS [gecko_fx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gold.sol solo 1] payout = position (pack: the gain only) — paid 53.002662 delta 3.002662
- PASS [gold.sol solo 1] profile records the climb — runs 7->8
- PASS [gold.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [atlas_pilot solo 2] live at the oracle price — status 2
- PASS [copper_fox solo 2] live at the oracle price — status 2
- PASS [yield935 solo 2] live at the oracle price — status 2
- PASS [dune.sol solo 2] live at the oracle price — status 2
- PASS [ember_fox solo 2] live at the oracle price — status 2
- PASS [saffron301 solo 2] live at the oracle price — status 2
- PASS [runner solo 2] live at the oracle price — status 2
- PASS [amber625 solo 2] live at the oracle price — status 2
- PASS [gold.sol solo 2] live at the oracle price — status 2
- PASS [basalt.sol solo 2] live at the oracle price — status 2
- PASS [sterlingrunner solo 2] live at the oracle price — status 2
- PASS [delta385 solo 2] live at the oracle price — status 2
- PASS [wolfx solo 2] live at the oracle price — status 2
- PASS [yield586 solo 2] live at the oracle price — status 2
- PASS [lynx88 solo 2] live at the oracle price — status 2
- PASS [deltawhale solo 2] live at the oracle price — status 2
- PASS [bora.sol solo 2] live at the oracle price — status 2
- PASS [marrakechdesk77 solo 2] live at the oracle price — status 2
- PASS [quant24 solo 2] live at the oracle price — status 2
- PASS [bora_hands solo 2] live at the oracle price — status 2
- PASS [carrytrader.sol solo 2] live at the oracle price — status 2
- PASS [gecko_fx solo 2] live at the oracle price — status 2
- PASS [rider88 solo 2] live at the oracle price — status 2
- PASS [ghibli_hunter solo 2] live at the oracle price — status 2
- PASS [atlas_pilot solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [yield935 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [copper_fox solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [dune.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ember_fox solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [runner solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [amber625 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [saffron301 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gold.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [sterlingrunner solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [basalt.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [delta385 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [wolfx solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [yield586 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx88 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [deltawhale solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [marrakechdesk77 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [quant24 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora_hands solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [carrytrader.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gecko_fx solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [rider88 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ghibli_hunter solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [sterlingrunner solo 2] state committed to Solana equals the rollup — 25000000/25000000
- PASS [sterlingrunner solo 2] payout = position (pack: the gain only) — paid 25 delta 0
- PASS [sterlingrunner solo 2] profile records the climb — runs 8->9
- PASS [runner solo 2] state committed to Solana equals the rollup — 10028601/10028601
- PASS [copper_fox solo 2] state committed to Solana equals the rollup — 99573880/99573880
- PASS [marrakechdesk77 solo 2] state committed to Solana equals the rollup — 9743802/9743802
- PASS [lynx88 solo 2] state committed to Solana equals the rollup — 101278688/101278688
- PASS [sterlingrunner solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [runner solo 2] payout = position (pack: the gain only) — paid 10.028601 delta 0.028601
- PASS [copper_fox solo 2] payout = position (pack: the gain only) — paid 99.57388 delta -0.42612
- PASS [marrakechdesk77 solo 2] payout = position (pack: the gain only) — paid 9.743802 delta -0.256198
- PASS [runner solo 2] profile records the climb — runs 9->10
- PASS [copper_fox solo 2] profile records the climb — runs 9->10
- PASS [marrakechdesk77 solo 2] profile records the climb — runs 9->10
- PASS [gecko_fx solo 2] state committed to Solana equals the rollup — 9743856/9743856
- PASS [lynx88 solo 2] payout = position (pack: the gain only) — paid 101.278688 delta 1.278688
- PASS [lynx88 solo 2] profile records the climb — runs 9->10
- PASS [marrakechdesk77 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [atlas_pilot solo 2] state committed to Solana equals the rollup — 10000000/10000000
- PASS [runner solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [copper_fox solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx88 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gecko_fx solo 2] payout = position (pack: the gain only) — paid 9.743856 delta -0.256144
- PASS [gecko_fx solo 2] profile records the climb — runs 13->14
- PASS [atlas_pilot solo 2] payout = position (pack: the gain only) — paid 10 delta 0
- PASS [atlas_pilot solo 2] profile records the climb — runs 8->9
- PASS [atlas_pilot solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gecko_fx solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [quant24 solo 2] state committed to Solana equals the rollup — 48888953/48888953
- PASS [bora_hands solo 2] state committed to Solana equals the rollup — 99063176/99063176
- PASS [carrytrader.sol solo 2] state committed to Solana equals the rollup — 100902505/100902505
- PASS [quant24 solo 2] payout = position (pack: the gain only) — paid 48.888953 delta -1.111047
- PASS [quant24 solo 2] profile records the climb — runs 9->10
- PASS [quant24 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora_hands solo 2] payout = position (pack: the gain only) — paid 99.063176 delta -0.936824
- PASS [bora_hands solo 2] profile records the climb — runs 9->10
- PASS [carrytrader.sol solo 2] payout = position (pack: the gain only) — paid 100.902505 delta 0.902505
- PASS [carrytrader.sol solo 2] profile records the climb — runs 8->9
- PASS [yield935 solo 2] state committed to Solana equals the rollup — 97774388/97774388
- PASS [carrytrader.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora_hands solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield935 solo 2] payout = position (pack: the gain only) — paid 97.774388 delta -2.225612
- PASS [yield935 solo 2] profile records the climb — runs 8->9
- PASS [delta385 solo 2] state committed to Solana equals the rollup — 49177276/49177276
- PASS [yield935 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [delta385 solo 2] payout = position (pack: the gain only) — paid 49.177276 delta -0.822724
- PASS [delta385 solo 2] profile records the climb — runs 8->9
- PASS [delta385 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [basalt.sol solo 2] state committed to Solana equals the rollup — 99816987/99816987
- PASS [bora.sol solo 2] state committed to Solana equals the rollup — 10253957/10253957
- PASS [wolfx solo 2] state committed to Solana equals the rollup — 24954248/24954248
- PASS [basalt.sol solo 2] payout = position (pack: the gain only) — paid 99.816987 delta -0.183013
- PASS [basalt.sol solo 2] profile records the climb — runs 9->10
- PASS [bora.sol solo 2] payout = position (pack: the gain only) — paid 10.253957 delta 0.253957
- PASS [bora.sol solo 2] profile records the climb — runs 11->12
- PASS [wolfx solo 2] payout = position (pack: the gain only) — paid 24.954248 delta -0.045752
- PASS [wolfx solo 2] profile records the climb — runs 10->11
- PASS [saffron301 solo 2] state committed to Solana equals the rollup — 50061657/50061657
- PASS [dune.sol solo 2] state committed to Solana equals the rollup — 51746732/51746732
- PASS [bora.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [wolfx solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [basalt.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [saffron301 solo 2] payout = position (pack: the gain only) — paid 50.061657 delta 0.061657
- PASS [saffron301 solo 2] profile records the climb — runs 14->15
- PASS [dune.sol solo 2] payout = position (pack: the gain only) — paid 51.746732 delta 1.746732
- PASS [dune.sol solo 2] profile records the climb — runs 13->14
- PASS [saffron301 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [dune.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ghibli_hunter solo 2] state committed to Solana equals the rollup — 102638582/102638582
- PASS [ghibli_hunter solo 2] payout = position (pack: the gain only) — paid 102.638582 delta 2.638582
- PASS [ghibli_hunter solo 2] profile records the climb — runs 14->15
- PASS [ghibli_hunter solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gold.sol solo 2] expired by the crank at 60 s — status 5, 121 ticks
- PASS [gold.sol solo 2] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [yield586 solo 2] expired by the crank at 60 s — status 5, 120 ticks
- PASS [yield586 solo 2] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [deltawhale solo 2] expired by the crank at 60 s — status 5, 120 ticks
- PASS [deltawhale solo 2] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [ember_fox solo 2] expired by the crank at 60 s — status 5, 121 ticks
- PASS [ember_fox solo 2] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [amber625 solo 2] expired by the crank at 60 s — status 5, 121 ticks
- PASS [amber625 solo 2] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [gold.sol solo 2] state committed to Solana equals the rollup — 94474061/94474061
- PASS [amber625 solo 2] state committed to Solana equals the rollup — 83887920/83887920
- PASS [ember_fox solo 2] state committed to Solana equals the rollup — 96463139/96463139
- PASS [yield586 solo 2] state committed to Solana equals the rollup — 25854294/25854294
- PASS [rider88 solo 2] expired by the crank at 60 s — status 5, 120 ticks
- PASS [rider88 solo 2] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [deltawhale solo 2] state committed to Solana equals the rollup — 20932955/20932955
- PASS [gold.sol solo 2] payout = position (pack: the gain only) — paid 94.474061 delta -5.525939
- PASS [gold.sol solo 2] profile records the climb — runs 8->9
- PASS [deltawhale solo 2] payout = position (pack: the gain only) — paid 20.932955 delta -4.067045
- PASS [rider88 solo 2] state committed to Solana equals the rollup — 8373598/8373598
- PASS [deltawhale solo 2] profile records the climb — runs 8->9
- PASS [amber625 solo 2] payout = position (pack: the gain only) — paid 83.88792 delta -16.11208
- PASS [ember_fox solo 2] payout = position (pack: the gain only) — paid 96.463139 delta -3.536861
- PASS [amber625 solo 2] profile records the climb — runs 8->9
- PASS [ember_fox solo 2] profile records the climb — runs 8->9
- PASS [yield586 solo 2] payout = position (pack: the gain only) — paid 25.854294 delta 0.854294
- PASS [yield586 solo 2] profile records the climb — runs 8->9
- PASS [gold.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [deltawhale solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [amber625 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ember_fox solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield586 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [rider88 solo 2] payout = position (pack: the gain only) — paid 8.373598 delta -1.626402
- PASS [rider88 solo 2] profile records the climb — runs 8->9
- PASS [rider88 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [refusals] stake above 100 tUSDC — refused with 6009 — got 6009 big failed: {"InstructionError":[0,{"Custom":6009}]}
- PASS [refusals] a session key acting for another wallet — refused with 6000 — got 6000 impersonate failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a price pushed by a player — refused with 6000 — got 6000 push failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a pack climb without a pack — refused with 6023 — got 6023 nopack failed: {"InstructionError":[0,{"Custom":6023}]}
- PASS [refusals] faucet twice in a row — refused with 6006 — got 6006 faucet failed: {"InstructionError":[1,{"Custom":6006}]}
- PASS [round 22443876] open with no market — refused with 6007 — got 6007 nomask failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [round 22443876] VRF drew an open market — asset 2
- PASS [round 22443876] all 24 players seated at once — 24 seated; 
- PASS [round 22443876] a 25th seat — refused with 6019 — got 6019 join round failed: {"InstructionError":[0,{"Custom":6019}]}
- PASS [round 22443876] the same player twice — refused with 6020 — got 6020 join round failed: {"InstructionError":[0,{"Custom":6020}]}
- PASS [round 22443876] delegate before the bell — refused with 6015 — got 6015 early failed: {"InstructionError":[0,{"Custom":6015}]}
- PASS [round 22443876] pot = entries — 24 players pot 240
- PASS [round 22443876] join after the bell — refused with 6016 — got 6016 join round failed: {"InstructionError":[0,{"Custom":6016}]}
- PASS [round 22443876] every seat live at the same entry — status 3
- PASS [round 22443876] cash out by a stranger — refused with 6021 — got 6021 stranger failed: {"InstructionError":[0,{"Custom":6021}]}
- PASS [round 22443876] ended by the crank at the bell — status 4, 140 ticks
- PASS [round 22443876] podium = best three positions — 1,8,11 vs 1,8,11
- PASS [round 22443876] prizes 50/30/20 sum to the pot — 120/72/48
- PASS [round 22443876] settled and every profile recorded — recorded 111111111111111111111111
- PASS [round 22443876] every balance moved by prize minus entry — 24/24
- PASS [round 22443878] open with no market — refused with 6007 — got 6007 nomask failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [round 22443878] VRF drew an open market — asset 1
- PASS [round 22443878] all 24 players seated at once — 24 seated; 
- PASS [round 22443878] a 25th seat — refused with 6019 — got 6019 join round failed: {"InstructionError":[0,{"Custom":6019}]}
- PASS [round 22443878] the same player twice — refused with 6020 — got 6020 join round failed: {"InstructionError":[0,{"Custom":6020}]}
- PASS [round 22443878] delegate before the bell — refused with 6015 — got 6015 early failed: {"InstructionError":[0,{"Custom":6015}]}
- PASS [round 22443878] pot = entries — 24 players pot 240
- PASS [round 22443878] join after the bell — refused with 6016 — got 6016 join round failed: {"InstructionError":[0,{"Custom":6016}]}
- PASS [round 22443878] every seat live at the same entry — status 3
- PASS [round 22443878] cash out by a stranger — refused with 6021 — got 6021 stranger failed: {"InstructionError":[0,{"Custom":6021}]}
- PASS [round 22443878] ended by the crank at the bell — status 4, 137 ticks
- PASS [round 22443878] podium = best three positions — 6,3,0 vs 6,3,0
- PASS [round 22443878] prizes 50/30/20 sum to the pot — 120/72/48
- PASS [round 22443878] settled and every profile recorded — recorded 111111111111111111111111
- PASS [round 22443878] every balance moved by prize minus entry — 24/24
- PASS [packs] VRF packs drawn — Gold,Gold,Silver,Silver,Bronze,Bronze
- PASS [packs] a second pack while one waits — refused with 6011 — got 6011 open pack failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ghibli_hunter solo pack] live at the oracle price — status 2
- PASS [ghibli_hunter solo pack] pack climb capped at its tier — top 2
- PASS [wolfx solo pack] live at the oracle price — status 2
- PASS [wolfx solo pack] pack climb capped at its tier — top 1
- PASS [gecko_fx solo pack] live at the oracle price — status 2
- PASS [gecko_fx solo pack] pack climb capped at its tier — top 2
- PASS [bora.sol solo pack] live at the oracle price — status 2
- PASS [bora.sol solo pack] pack climb capped at its tier — top 1
- PASS [dune.sol solo pack] live at the oracle price — status 2
- PASS [dune.sol solo pack] pack climb capped at its tier — top 4
- PASS [saffron301 solo pack] live at the oracle price — status 2
- PASS [saffron301 solo pack] pack climb capped at its tier — top 4
- PASS [ghibli_hunter solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [wolfx solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gecko_fx solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora.sol solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [dune.sol solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [saffron301 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [saffron301 solo pack] state committed to Solana equals the rollup — 10000000/10000000
- PASS [bora.sol solo pack] state committed to Solana equals the rollup — 10207986/10207986
- PASS [saffron301 solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [saffron301 solo pack] profile records the climb — runs 17->18
- PASS [bora.sol solo pack] payout = position (pack: the gain only) — paid 0.207986 delta 0.207986
- PASS [bora.sol solo pack] profile records the climb — runs 14->15
- PASS [saffron301 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora.sol solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ghibli_hunter solo pack] state committed to Solana equals the rollup — 9753194/9753194
- PASS [ghibli_hunter solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [ghibli_hunter solo pack] profile records the climb — runs 17->18
- PASS [ghibli_hunter solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gecko_fx solo pack] state committed to Solana equals the rollup — 9415126/9415126
- PASS [dune.sol solo pack] state committed to Solana equals the rollup — 10703113/10703113
- PASS [gecko_fx solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [gecko_fx solo pack] profile records the climb — runs 16->17
- PASS [dune.sol solo pack] payout = position (pack: the gain only) — paid 0.703113 delta 0.703113
- PASS [dune.sol solo pack] profile records the climb — runs 16->17
- PASS [gecko_fx solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [dune.sol solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [wolfx solo pack] expired by the crank at 60 s — status 5, 121 ticks
- PASS [wolfx solo pack] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [wolfx solo pack] state committed to Solana equals the rollup — 10106279/10106279
- PASS [wolfx solo pack] payout = position (pack: the gain only) — paid 0.106279 delta 0.106279
- PASS [wolfx solo pack] profile records the climb — runs 13->14
- PASS [wolfx solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
