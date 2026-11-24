# Battery report

On-chain battery on Solana devnet + MagicBlock devnet-eu (`npm run battery -- 24 2 2`): 24 players with realistic handles, each with its own MagicBlock session key, playing at the same time.

| Run | Program | What | Checks |
|---|---|---|---|
| D, 24 Nov 2026 | **current deployment** `BS6874Pq…`, from Siroclimb's own deployer | 48 simultaneous solo climbs, refusals, two full 24-seat rounds (both TSLAx, drawn by VRF), VRF packs and their free climbs | **404 / 404** |
| C, 24 Nov 2026 | previous program (closed), with on-chain market hours | same | 400 / 400 |
| B, 23 Nov 2026 | previous program, first RWA build | two full 24-seat rounds | 66 / 67 (FINDINGS #7, test bug) |
| A, 23 Nov 2026 | previous program, first RWA build | 48 simultaneous solo climbs, packs | 338 / 342 (FINDINGS #6, stuck round slot) |

The players of run D are new keypairs funded only by Siroclimb's deployer. Runs A to C are in the git history of this file.

## Run D

Run 2026-11-24T11:28:51.535Z · program `BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ` · rollup https://devnet-eu.magicblock.app · 24 players · 2 solo waves · 2 rounds · 507 s

**404 / 404 checks passed.** Admin SOL 6.3399 -> 4.4648 (funding players).

Solo climbs settled: 48 (39 cashed, 9 expired), top leverage reached 4x.

Players (handles on chain): candlerider_gold, candleowl24, mistrallynx, levechequeen, harmattan_whale, lynx24, nvidiasmith24, harmattan156, yield.sol, simoom_smith, simoombaron_gold, desk42, theta888, desk, bora692, saffronhunter.so, theta_desk, wolf88, ember803, tramontaneking.s, runnerx, scout_fx, atlasqueen_fx, nvidiabull.

### Latencies

| step | n | median ms | max ms |
|---|---|---|---|
| fund players (8 per tx) | 4 | 1011 | 1049 |
| onboard (profile, faucet, session, allowance) | 25 | 1096 | 1495 |
| stake + delegate (Solana) | 54 | 1011 | 1306 |
| delegation visible on the rollup | 54 | 18 | 245 |
| begin + crank (rollup) | 54 | 338 | 489 |
| cash out + commit/undelegate (rollup) | 43 | 307 | 432 |
| undelegation back on Solana | 54 | 924 | 1189 |
| settle (Solana) | 54 | 1049 | 1517 |
| finish by a stranger (rollup) | 11 | 308 | 349 |
| open round + VRF request (Solana) | 2 | 1072 | 1072 |
| round market VRF callback | 2 | 1158 | 1158 |
| join (Solana) | 48 | 981 | 1300 |
| delegate round (Solana) | 2 | 1039 | 1039 |
| go live + crank (rollup) | 2 | 498 | 498 |
| round cash out (rollup) | 31 | 323 | 394 |
| finish round + commit/undelegate (rollup) | 2 | 310 | 310 |
| round back on Solana | 2 | 986 | 986 |
| settle round (Solana) | 2 | 1069 | 1069 |
| record profiles (6 per tx) | 2 | 3931 | 3931 |
| open pack + VRF request (Solana) | 6 | 995 | 1020 |
| pack VRF callback | 6 | 1507 | 1526 |

### Checks

- PASS [theta888 solo 1] live at the oracle price — status 2
- PASS [ember803 solo 1] live at the oracle price — status 2
- PASS [candlerider_gold solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [bora692 solo 1] live at the oracle price — status 2
- PASS [simoombaron_gold solo 1] live at the oracle price — status 2
- PASS [harmattan156 solo 1] live at the oracle price — status 2
- PASS [nvidiasmith24 solo 1] live at the oracle price — status 2
- PASS [runnerx solo 1] live at the oracle price — status 2
- PASS [desk solo 1] live at the oracle price — status 2
- PASS [theta_desk solo 1] live at the oracle price — status 2
- PASS [atlasqueen_fx solo 1] live at the oracle price — status 2
- PASS [nvidiabull solo 1] live at the oracle price — status 2
- PASS [lynx24 solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [simoom_smith solo 1] live at the oracle price — status 2
- PASS [saffronhunter.so solo 1] live at the oracle price — status 2
- PASS [scout_fx solo 1] live at the oracle price — status 2
- PASS [desk42 solo 1] live at the oracle price — status 2
- PASS [yield.sol solo 1] live at the oracle price — status 2
- PASS [wolf88 solo 1] live at the oracle price — status 2
- PASS [levechequeen solo 1] live at the oracle price — status 2
- PASS [candleowl24 solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [candlerider_gold solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [tramontaneking.s solo 1] live at the oracle price — status 2
- PASS [harmattan_whale solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candlerider_gold solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candlerider_gold solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candlerider_gold solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [mistrallynx solo 1] live at the oracle price — status 2
- PASS [theta888 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ember803 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [bora692 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [simoombaron_gold solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan156 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [nvidiasmith24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [desk solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [runnerx solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [mistrallynx solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [theta_desk solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 1] live at the oracle price — status 2
- PASS [atlasqueen_fx solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [nvidiabull solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [simoom_smith solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [saffronhunter.so solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [scout_fx solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [desk42 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [yield.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [wolf88 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [tramontaneking.s solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [mistrallynx solo 1] crank ticks on the rollup — 8 ticks in 3 s
- PASS [desk solo 1] state committed to Solana equals the rollup — 99370388/99370388
- PASS [candleowl24 solo 1] crank ticks on the rollup — 8 ticks in 3 s
- PASS [scout_fx solo 1] state committed to Solana equals the rollup — 49761211/49761211
- PASS [simoombaron_gold solo 1] state committed to Solana equals the rollup — 25198302/25198302
- PASS [desk solo 1] payout = position (pack: the gain only) — paid 99.370388 delta -0.629612
- PASS [desk solo 1] profile records the climb — runs 0->1
- PASS [simoombaron_gold solo 1] payout = position (pack: the gain only) — paid 25.198302 delta 0.198302
- PASS [scout_fx solo 1] payout = position (pack: the gain only) — paid 49.761211 delta -0.238789
- PASS [scout_fx solo 1] profile records the climb — runs 0->1
- PASS [simoombaron_gold solo 1] profile records the climb — runs 0->1
- PASS [nvidiabull solo 1] state committed to Solana equals the rollup — 100355472/100355472
- PASS [candlerider_gold solo 1] state committed to Solana equals the rollup — 99694120/99694120
- PASS [desk42 solo 1] state committed to Solana equals the rollup — 49287369/49287369
- PASS [desk solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [simoombaron_gold solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [scout_fx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo 1] state committed to Solana equals the rollup — 49802558/49802558
- PASS [levechequeen solo 1] state committed to Solana equals the rollup — 50332069/50332069
- PASS [nvidiabull solo 1] payout = position (pack: the gain only) — paid 100.355472 delta 0.355472
- PASS [nvidiabull solo 1] profile records the climb — runs 0->1
- PASS [nvidiasmith24 solo 1] state committed to Solana equals the rollup — 48458370/48458370
- PASS [desk42 solo 1] payout = position (pack: the gain only) — paid 49.287369 delta -0.712631
- PASS [candlerider_gold solo 1] payout = position (pack: the gain only) — paid 99.69412 delta -0.30588
- PASS [desk42 solo 1] profile records the climb — runs 0->1
- PASS [candlerider_gold solo 1] profile records the climb — runs 0->1
- PASS [nvidiabull solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo 1] payout = position (pack: the gain only) — paid 49.802558 delta -0.197442
- PASS [levechequeen solo 1] payout = position (pack: the gain only) — paid 50.332069 delta 0.332069
- PASS [harmattan_whale solo 1] profile records the climb — runs 0->1
- PASS [levechequeen solo 1] profile records the climb — runs 0->1
- PASS [candlerider_gold solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [desk42 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [nvidiasmith24 solo 1] payout = position (pack: the gain only) — paid 48.45837 delta -1.54163
- PASS [nvidiasmith24 solo 1] profile records the climb — runs 0->1
- PASS [levechequeen solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan156 solo 1] state committed to Solana equals the rollup — 99236704/99236704
- PASS [nvidiasmith24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan156 solo 1] payout = position (pack: the gain only) — paid 99.236704 delta -0.763296
- PASS [harmattan156 solo 1] profile records the climb — runs 0->1
- PASS [harmattan156 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [runnerx solo 1] state committed to Solana equals the rollup — 10109202/10109202
- PASS [lynx24 solo 1] state committed to Solana equals the rollup — 10142770/10142770
- PASS [yield.sol solo 1] state committed to Solana equals the rollup — 100919745/100919745
- PASS [wolf88 solo 1] state committed to Solana equals the rollup — 99392510/99392510
- PASS [runnerx solo 1] payout = position (pack: the gain only) — paid 10.109202 delta 0.109202
- PASS [runnerx solo 1] profile records the climb — runs 0->1
- PASS [tramontaneking.s solo 1] state committed to Solana equals the rollup — 24536058/24536058
- PASS [theta888 solo 1] state committed to Solana equals the rollup — 100725542/100725542
- PASS [lynx24 solo 1] payout = position (pack: the gain only) — paid 10.14277 delta 0.14277
- PASS [lynx24 solo 1] profile records the climb — runs 0->1
- PASS [runnerx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [wolf88 solo 1] payout = position (pack: the gain only) — paid 99.39251 delta -0.60749
- PASS [wolf88 solo 1] profile records the climb — runs 0->1
- PASS [yield.sol solo 1] payout = position (pack: the gain only) — paid 100.919745 delta 0.919745
- PASS [yield.sol solo 1] profile records the climb — runs 0->1
- PASS [tramontaneking.s solo 1] payout = position (pack: the gain only) — paid 24.536058 delta -0.463942
- PASS [tramontaneking.s solo 1] profile records the climb — runs 0->1
- PASS [theta888 solo 1] payout = position (pack: the gain only) — paid 100.725542 delta 0.725542
- PASS [lynx24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [wolf88 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [theta888 solo 1] profile records the climb — runs 0->1
- PASS [bora692 solo 1] state committed to Solana equals the rollup — 54555803/54555803
- PASS [saffronhunter.so solo 1] state committed to Solana equals the rollup — 49598414/49598414
- PASS [yield.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [theta888 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora692 solo 1] payout = position (pack: the gain only) — paid 54.555803 delta 4.555803
- PASS [tramontaneking.s solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [saffronhunter.so solo 1] payout = position (pack: the gain only) — paid 49.598414 delta -0.401586
- PASS [bora692 solo 1] profile records the climb — runs 0->1
- PASS [saffronhunter.so solo 1] profile records the climb — runs 0->1
- PASS [saffronhunter.so solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora692 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [atlasqueen_fx solo 1] state committed to Solana equals the rollup — 98172718/98172718
- PASS [atlasqueen_fx solo 1] payout = position (pack: the gain only) — paid 98.172718 delta -1.827282
- PASS [atlasqueen_fx solo 1] profile records the climb — runs 0->1
- PASS [atlasqueen_fx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] state committed to Solana equals the rollup — 53519192/53519192
- PASS [ember803 solo 1] state committed to Solana equals the rollup — 10806312/10806312
- PASS [mistrallynx solo 1] payout = position (pack: the gain only) — paid 53.519192 delta 3.519192
- PASS [mistrallynx solo 1] profile records the climb — runs 0->1
- PASS [ember803 solo 1] payout = position (pack: the gain only) — paid 10.806312 delta 0.806312
- PASS [ember803 solo 1] profile records the climb — runs 0->1
- PASS [ember803 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [simoom_smith solo 1] expired by the crank at 60 s — status 5, 120 ticks
- PASS [simoom_smith solo 1] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [theta_desk solo 1] expired by the crank at 60 s — status 5, 121 ticks
- PASS [theta_desk solo 1] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [simoom_smith solo 1] state committed to Solana equals the rollup — 102109033/102109033
- PASS [theta_desk solo 1] state committed to Solana equals the rollup — 25462386/25462386
- PASS [simoom_smith solo 1] payout = position (pack: the gain only) — paid 102.109033 delta 2.109033
- PASS [simoom_smith solo 1] profile records the climb — runs 0->1
- PASS [theta_desk solo 1] payout = position (pack: the gain only) — paid 25.462386 delta 0.462386
- PASS [theta_desk solo 1] profile records the climb — runs 0->1
- PASS [candleowl24 solo 1] expired by the crank at 60 s — status 5, 120 ticks
- PASS [candleowl24 solo 1] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [simoom_smith solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [theta_desk solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candleowl24 solo 1] state committed to Solana equals the rollup — 127338954/127338954
- PASS [candleowl24 solo 1] payout = position (pack: the gain only) — paid 127.338954 delta 27.338954
- PASS [candleowl24 solo 1] profile records the climb — runs 0->1
- PASS [candleowl24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [simoombaron_gold solo 2] live at the oracle price — status 2
- PASS [tramontaneking.s solo 2] live at the oracle price — status 2
- PASS [nvidiasmith24 solo 2] live at the oracle price — status 2
- PASS [harmattan156 solo 2] live at the oracle price — status 2
- PASS [desk42 solo 2] live at the oracle price — status 2
- PASS [harmattan_whale solo 2] live at the oracle price — status 2
- PASS [runnerx solo 2] live at the oracle price — status 2
- PASS [theta888 solo 2] live at the oracle price — status 2
- PASS [ember803 solo 2] live at the oracle price — status 2
- PASS [desk solo 2] live at the oracle price — status 2
- PASS [candleowl24 solo 2] live at the oracle price — status 2
- PASS [simoom_smith solo 2] live at the oracle price — status 2
- PASS [atlasqueen_fx solo 2] live at the oracle price — status 2
- PASS [nvidiabull solo 2] live at the oracle price — status 2
- PASS [yield.sol solo 2] live at the oracle price — status 2
- PASS [lynx24 solo 2] live at the oracle price — status 2
- PASS [candlerider_gold solo 2] live at the oracle price — status 2
- PASS [scout_fx solo 2] live at the oracle price — status 2
- PASS [levechequeen solo 2] live at the oracle price — status 2
- PASS [theta_desk solo 2] live at the oracle price — status 2
- PASS [mistrallynx solo 2] live at the oracle price — status 2
- PASS [wolf88 solo 2] live at the oracle price — status 2
- PASS [bora692 solo 2] live at the oracle price — status 2
- PASS [saffronhunter.so solo 2] live at the oracle price — status 2
- PASS [simoombaron_gold solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [tramontaneking.s solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [nvidiasmith24 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan156 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [desk42 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [runnerx solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [theta888 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [desk solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ember803 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [simoom_smith solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [atlasqueen_fx solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [nvidiabull solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [yield.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx24 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [scout_fx solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [theta_desk solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [mistrallynx solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [wolf88 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora692 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [saffronhunter.so solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo 2] state committed to Solana equals the rollup — 50118350/50118350
- PASS [candlerider_gold solo 2] payout = position (pack: the gain only) — paid 50.11835 delta 0.11835
- PASS [candlerider_gold solo 2] profile records the climb — runs 1->2
- PASS [candleowl24 solo 2] state committed to Solana equals the rollup — 10129245/10129245
- PASS [candlerider_gold solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [desk solo 2] state committed to Solana equals the rollup — 50646228/50646228
- PASS [candleowl24 solo 2] payout = position (pack: the gain only) — paid 10.129245 delta 0.129245
- PASS [candleowl24 solo 2] profile records the climb — runs 1->2
- PASS [candleowl24 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan156 solo 2] state committed to Solana equals the rollup — 98715507/98715507
- PASS [desk solo 2] payout = position (pack: the gain only) — paid 50.646228 delta 0.646228
- PASS [desk solo 2] profile records the climb — runs 1->2
- PASS [desk solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [nvidiabull solo 2] state committed to Solana equals the rollup — 100919631/100919631
- PASS [harmattan156 solo 2] payout = position (pack: the gain only) — paid 98.715507 delta -1.284493
- PASS [harmattan156 solo 2] profile records the climb — runs 1->2
- PASS [simoom_smith solo 2] state committed to Solana equals the rollup — 100456531/100456531
- PASS [harmattan156 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [nvidiabull solo 2] payout = position (pack: the gain only) — paid 100.919631 delta 0.919631
- PASS [nvidiabull solo 2] profile records the climb — runs 1->2
- PASS [simoom_smith solo 2] payout = position (pack: the gain only) — paid 100.456531 delta 0.456531
- PASS [simoom_smith solo 2] profile records the climb — runs 1->2
- PASS [nvidiabull solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [simoom_smith solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [desk42 solo 2] state committed to Solana equals the rollup — 10045654/10045654
- PASS [theta888 solo 2] state committed to Solana equals the rollup — 50646228/50646228
- PASS [lynx24 solo 2] state committed to Solana equals the rollup — 25021392/25021392
- PASS [desk42 solo 2] payout = position (pack: the gain only) — paid 10.045654 delta 0.045654
- PASS [desk42 solo 2] profile records the climb — runs 1->2
- PASS [theta888 solo 2] payout = position (pack: the gain only) — paid 50.646228 delta 0.646228
- PASS [theta888 solo 2] profile records the climb — runs 1->2
- PASS [desk42 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo 2] payout = position (pack: the gain only) — paid 25.021392 delta 0.021392
- PASS [lynx24 solo 2] profile records the climb — runs 1->2
- PASS [theta888 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [runnerx solo 2] state committed to Solana equals the rollup — 24535329/24535329
- PASS [lynx24 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [tramontaneking.s solo 2] state committed to Solana equals the rollup — 25241203/25241203
- PASS [runnerx solo 2] payout = position (pack: the gain only) — paid 24.535329 delta -0.464671
- PASS [runnerx solo 2] profile records the climb — runs 1->2
- PASS [tramontaneking.s solo 2] payout = position (pack: the gain only) — paid 25.241203 delta 0.241203
- PASS [tramontaneking.s solo 2] profile records the climb — runs 1->2
- PASS [runnerx solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo 2] state committed to Solana equals the rollup — 98139159/98139159
- PASS [tramontaneking.s solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [theta_desk solo 2] state committed to Solana equals the rollup — 99535062/99535062
- PASS [levechequeen solo 2] payout = position (pack: the gain only) — paid 98.139159 delta -1.860841
- PASS [levechequeen solo 2] profile records the climb — runs 1->2
- PASS [saffronhunter.so solo 2] state committed to Solana equals the rollup — 24779096/24779096
- PASS [levechequeen solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [theta_desk solo 2] payout = position (pack: the gain only) — paid 99.535062 delta -0.464938
- PASS [yield.sol solo 2] state committed to Solana equals the rollup — 9997079/9997079
- PASS [theta_desk solo 2] profile records the climb — runs 1->2
- PASS [scout_fx solo 2] state committed to Solana equals the rollup — 10230354/10230354
- PASS [saffronhunter.so solo 2] payout = position (pack: the gain only) — paid 24.779096 delta -0.220904
- PASS [saffronhunter.so solo 2] profile records the climb — runs 1->2
- PASS [theta_desk solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [scout_fx solo 2] payout = position (pack: the gain only) — paid 10.230354 delta 0.230354
- PASS [yield.sol solo 2] payout = position (pack: the gain only) — paid 9.997079 delta -0.002921
- PASS [scout_fx solo 2] profile records the climb — runs 1->2
- PASS [yield.sol solo 2] profile records the climb — runs 1->2
- PASS [saffronhunter.so solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ember803 solo 2] state committed to Solana equals the rollup — 26214875/26214875
- PASS [scout_fx solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ember803 solo 2] payout = position (pack: the gain only) — paid 26.214875 delta 1.214875
- PASS [ember803 solo 2] profile records the climb — runs 1->2
- PASS [mistrallynx solo 2] state committed to Solana equals the rollup — 98534885/98534885
- PASS [ember803 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 2] payout = position (pack: the gain only) — paid 98.534885 delta -1.465115
- PASS [mistrallynx solo 2] profile records the climb — runs 1->2
- PASS [mistrallynx solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [nvidiasmith24 solo 2] expired by the crank at 60 s — status 5, 120 ticks
- PASS [nvidiasmith24 solo 2] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [simoombaron_gold solo 2] expired by the crank at 60 s — status 5, 120 ticks
- PASS [simoombaron_gold solo 2] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [wolf88 solo 2] expired by the crank at 60 s — status 5, 119 ticks
- PASS [wolf88 solo 2] crank ticked ~2/s for the whole climb — 119 ticks
- PASS [harmattan_whale solo 2] expired by the crank at 60 s — status 5, 121 ticks
- PASS [harmattan_whale solo 2] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [simoombaron_gold solo 2] state committed to Solana equals the rollup — 9935389/9935389
- PASS [nvidiasmith24 solo 2] state committed to Solana equals the rollup — 25105305/25105305
- PASS [atlasqueen_fx solo 2] expired by the crank at 60 s — status 5, 121 ticks
- PASS [atlasqueen_fx solo 2] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [bora692 solo 2] expired by the crank at 60 s — status 5, 121 ticks
- PASS [bora692 solo 2] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [simoombaron_gold solo 2] payout = position (pack: the gain only) — paid 9.935389 delta -0.064611
- PASS [simoombaron_gold solo 2] profile records the climb — runs 1->2
- PASS [harmattan_whale solo 2] state committed to Solana equals the rollup — 10133561/10133561
- PASS [wolf88 solo 2] state committed to Solana equals the rollup — 25186730/25186730
- PASS [atlasqueen_fx solo 2] state committed to Solana equals the rollup — 95979295/95979295
- PASS [nvidiasmith24 solo 2] payout = position (pack: the gain only) — paid 25.105305 delta 0.105305
- PASS [nvidiasmith24 solo 2] profile records the climb — runs 1->2
- PASS [bora692 solo 2] state committed to Solana equals the rollup — 95937090/95937090
- PASS [simoombaron_gold solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [nvidiasmith24 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo 2] payout = position (pack: the gain only) — paid 10.133561 delta 0.133561
- PASS [harmattan_whale solo 2] profile records the climb — runs 1->2
- PASS [wolf88 solo 2] payout = position (pack: the gain only) — paid 25.18673 delta 0.18673
- PASS [wolf88 solo 2] profile records the climb — runs 1->2
- PASS [atlasqueen_fx solo 2] payout = position (pack: the gain only) — paid 95.979295 delta -4.020705
- PASS [atlasqueen_fx solo 2] profile records the climb — runs 1->2
- PASS [bora692 solo 2] payout = position (pack: the gain only) — paid 95.93709 delta -4.06291
- PASS [bora692 solo 2] profile records the climb — runs 1->2
- PASS [harmattan_whale solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [wolf88 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [atlasqueen_fx solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora692 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [refusals] stake above 100 tUSDC — refused with 6009 — got 6009 big failed: {"InstructionError":[0,{"Custom":6009}]}
- PASS [refusals] a session key acting for another wallet — refused with 6000 — got 6000 impersonate failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a price pushed by a player — refused with 6000 — got 6000 push failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a pack climb without a pack — refused with 6023 — got 6023 nopack failed: {"InstructionError":[0,{"Custom":6023}]}
- PASS [refusals] faucet twice in a row — refused with 6006 — got 6006 faucet failed: {"InstructionError":[1,{"Custom":6006}]}
- PASS [round 22443999] open with no market — refused with 6007 — got 6007 nomask failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [round 22443999] VRF drew an open market — asset 0
- PASS [round 22443999] all 24 players seated at once — 24 seated; 
- PASS [round 22443999] a 25th seat — refused with 6019 — got 6019 join round failed: {"InstructionError":[0,{"Custom":6019}]}
- PASS [round 22443999] the same player twice — refused with 6020 — got 6020 join round failed: {"InstructionError":[0,{"Custom":6020}]}
- PASS [round 22443999] delegate before the bell — refused with 6015 — got 6015 early failed: {"InstructionError":[0,{"Custom":6015}]}
- PASS [round 22443999] pot = entries — 24 players pot 240
- PASS [round 22443999] join after the bell — refused with 6016 — got 6016 join round failed: {"InstructionError":[0,{"Custom":6016}]}
- PASS [round 22443999] every seat live at the same entry — status 3
- PASS [round 22443999] cash out by a stranger — refused with 6021 — got 6021 stranger failed: {"InstructionError":[0,{"Custom":6021}]}
- PASS [round 22443999] ended by the crank at the bell — status 4, 137 ticks
- PASS [round 22443999] podium = best three positions — 13,3,23 vs 13,3,23
- PASS [round 22443999] prizes 50/30/20 sum to the pot — 120/72/48
- PASS [round 22443999] settled and every profile recorded — recorded 111111111111111111111111
- PASS [round 22443999] every balance moved by prize minus entry — 24/24
- PASS [round 22444001] open with no market — refused with 6007 — got 6007 nomask failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [round 22444001] VRF drew an open market — asset 0
- PASS [round 22444001] all 24 players seated at once — 24 seated; 
- PASS [round 22444001] a 25th seat — refused with 6019 — got 6019 join round failed: {"InstructionError":[0,{"Custom":6019}]}
- PASS [round 22444001] the same player twice — refused with 6020 — got 6020 join round failed: {"InstructionError":[0,{"Custom":6020}]}
- PASS [round 22444001] delegate before the bell — refused with 6015 — got 6015 early failed: {"InstructionError":[0,{"Custom":6015}]}
- PASS [round 22444001] pot = entries — 24 players pot 240
- PASS [round 22444001] join after the bell — refused with 6016 — got 6016 join round failed: {"InstructionError":[0,{"Custom":6016}]}
- PASS [round 22444001] every seat live at the same entry — status 3
- PASS [round 22444001] cash out by a stranger — refused with 6021 — got 6021 stranger failed: {"InstructionError":[0,{"Custom":6021}]}
- PASS [round 22444001] ended by the crank at the bell — status 4, 134 ticks
- PASS [round 22444001] podium = best three positions — 8,16,0 vs 8,16,0
- PASS [round 22444001] prizes 50/30/20 sum to the pot — 120/72/48
- PASS [round 22444001] settled and every profile recorded — recorded 111111111111111111111111
- PASS [round 22444001] every balance moved by prize minus entry — 24/24
- PASS [packs] VRF packs drawn — Silver,Silver,Silver,Silver,Bronze,Bronze
- PASS [packs] a second pack while one waits — refused with 6011 — got 6011 open pack failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold solo pack] live at the oracle price — status 2
- PASS [candlerider_gold solo pack] pack climb capped at its tier — top 2
- PASS [levechequeen solo pack] live at the oracle price — status 2
- PASS [levechequeen solo pack] pack climb capped at its tier — top 2
- PASS [mistrallynx solo pack] live at the oracle price — status 2
- PASS [mistrallynx solo pack] pack climb capped at its tier — top 2
- PASS [harmattan_whale solo pack] live at the oracle price — status 2
- PASS [harmattan_whale solo pack] pack climb capped at its tier — top 1
- PASS [candleowl24 solo pack] live at the oracle price — status 2
- PASS [candleowl24 solo pack] pack climb capped at its tier — top 2
- PASS [lynx24 solo pack] live at the oracle price — status 2
- PASS [lynx24 solo pack] pack climb capped at its tier — top 1
- PASS [candlerider_gold solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [mistrallynx solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx24 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo pack] state committed to Solana equals the rollup — 10000000/10000000
- PASS [candlerider_gold solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [candlerider_gold solo pack] profile records the climb — runs 4->5
- PASS [candlerider_gold solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candleowl24 solo pack] state committed to Solana equals the rollup — 9832738/9832738
- PASS [candleowl24 solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [candleowl24 solo pack] profile records the climb — runs 4->5
- PASS [candleowl24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo pack] state committed to Solana equals the rollup — 10276387/10276387
- PASS [mistrallynx solo pack] payout = position (pack: the gain only) — paid 0.276387 delta 0.276387
- PASS [mistrallynx solo pack] profile records the climb — runs 4->5
- PASS [mistrallynx solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo pack] state committed to Solana equals the rollup — 9904324/9904324
- PASS [lynx24 solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [lynx24 solo pack] profile records the climb — runs 4->5
- PASS [lynx24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo pack] expired by the crank at 60 s — status 5, 120 ticks
- PASS [harmattan_whale solo pack] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [levechequeen solo pack] expired by the crank at 60 s — status 5, 121 ticks
- PASS [levechequeen solo pack] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [harmattan_whale solo pack] state committed to Solana equals the rollup — 9910904/9910904
- PASS [levechequeen solo pack] state committed to Solana equals the rollup — 11428620/11428620
- PASS [harmattan_whale solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [harmattan_whale solo pack] profile records the climb — runs 4->5
- PASS [levechequeen solo pack] payout = position (pack: the gain only) — paid 1.42862 delta 1.42862
- PASS [levechequeen solo pack] profile records the climb — runs 4->5
- PASS [levechequeen solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
