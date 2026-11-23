# Battery report

Two runs on Solana devnet + MagicBlock devnet-eu on 23 Nov 2026, 24 players with realistic handles, each with its own MagicBlock session key (`npm run battery`):

| Run | What | Checks |
|---|---|---|
| A: `battery 24 2 2` | 2 waves of 24 simultaneous solo climbs (48 climbs: 41 cashed, 7 rode to the bell), refusals, VRF packs and their free climbs | 338 / 342 |
| B: `battery 24 2 0` | 2 full rounds of 24 players on one account (GBP/USD and NVDAx drawn by VRF), refusals, packs | 66 / 67 |

Every failed check is a finding, logged in [FINDINGS.md](FINDINGS.md) with its fix: run A's four failures are one bug (#6, a round slot left on the rollup by an earlier crashed run blocked both of its rounds), run B's one failure was a test expecting the wrong error because devnet's clock lags the wall clock (#7). No solo climb, round payout or profile check failed.

## Run B: full rounds

Run 2026-11-23T22:34:52.427Z · program `29sucV8aHGufy1AWrKzgp9gBPRHBG9jSxAsSWXe7M2ov` · rollup https://devnet-eu.magicblock.app · 24 players · 0 solo waves · 2 rounds · 383 s

**66 / 67 checks passed.** Admin SOL 5.1060 -> 3.6060 (funding players).



Players (handles on chain): saffron301, dune.sol, ghibli_hunter, gecko_fx, bora.sol, wolfx, marrakechdesk77, bora_hands, amber625, rider88, lynx88, yield586, carrytrader.sol, gold.sol, sterlingrunner, yield935, basalt.sol, delta385, ember_fox, runner, quant24, atlas_pilot, deltawhale, copper_fox.

### Latencies

| step | n | median ms | max ms |
|---|---|---|---|
| fund players (8 per tx) | 3 | 1045 | 1072 |
| open round + VRF request (Solana) | 2 | 1528 | 1528 |
| round market VRF callback | 2 | 727 | 727 |
| join (Solana) | 48 | 1159 | 1845 |
| delegate round (Solana) | 2 | 1070 | 1070 |
| go live + crank (rollup) | 2 | 471 | 471 |
| round cash out (rollup) | 36 | 392 | 606 |
| finish round + commit/undelegate (rollup) | 2 | 332 | 332 |
| round back on Solana | 2 | 942 | 942 |
| settle round (Solana) | 2 | 1167 | 1167 |
| record profiles (10 per tx) | 2 | 3024 | 3024 |
| open pack + VRF request (Solana) | 4 | 948 | 948 |
| pack VRF callback | 4 | 1175 | 1188 |
| stake + delegate (Solana) | 4 | 1058 | 1346 |
| delegation visible on the rollup | 4 | 95 | 154 |
| begin + crank (rollup) | 4 | 376 | 382 |
| cash out + commit/undelegate (rollup) | 3 | 301 | 368 |
| undelegation back on Solana | 4 | 1036 | 1078 |
| settle (Solana) | 4 | 1081 | 1120 |
| finish by a stranger (rollup) | 1 | 326 | 326 |

### Checks

- PASS [refusals] stake above 100 tUSDC — refused with 6009 — got 6009 big failed: {"InstructionError":[0,{"Custom":6009}]}
- PASS [refusals] a session key acting for another wallet — refused with 6000 — got 6000 impersonate failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a price pushed by a player — refused with 6000 — got 6000 push failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a pack climb without a pack — refused with 6023 — got 6023 nopack failed: {"InstructionError":[0,{"Custom":6023}]}
- PASS [refusals] faucet twice in a row — refused with 6006 — got 6006 faucet failed: {"InstructionError":[1,{"Custom":6006}]}
- PASS [round 22443417] open with no market — refused with 6007 — got 6007 nomask failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [round 22443417] VRF drew an open market — asset 4
- PASS [round 22443417] all 24 players seated at once — 24 seated; 
- PASS [round 22443417] a 25th seat — refused with 6019 — got 6019 join round failed: {"InstructionError":[0,{"Custom":6019}]}
- PASS [round 22443417] the same player twice — refused with 6020 — got 6020 join round failed: {"InstructionError":[0,{"Custom":6020}]}
- PASS [round 22443417] delegate before the bell — refused with 6015 — got 6015 early failed: {"InstructionError":[0,{"Custom":6015}]}
- PASS [round 22443417] pot = entries — 24 players pot 240
- FAIL [round 22443417] join after the bell — refused with 6016 — got 6019 join round failed: {"InstructionError":[0,{"Custom":6019}]}
- PASS [round 22443417] every seat live at the same entry — status 3
- PASS [round 22443417] cash out by a stranger — refused with 6021 — got 6021 stranger failed: {"InstructionError":[0,{"Custom":6021}]}
- PASS [round 22443417] ended by the crank at the bell — status 4, 138 ticks
- PASS [round 22443417] podium = best three positions — 6,22,11 vs 6,22,11
- PASS [round 22443417] prizes 50/30/20 sum to the pot — 120/72/48
- PASS [round 22443417] settled and every profile recorded — recorded 111111111111111111111111
- PASS [round 22443417] every balance moved by prize minus entry — 24/24
- PASS [round 22443419] open with no market — refused with 6007 — got 6007 nomask failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [round 22443419] VRF drew an open market — asset 1
- PASS [round 22443419] all 24 players seated at once — 24 seated; 
- PASS [round 22443419] a 25th seat — refused with 6019 — got 6019 join round failed: {"InstructionError":[0,{"Custom":6019}]}
- PASS [round 22443419] the same player twice — refused with 6020 — got 6020 join round failed: {"InstructionError":[0,{"Custom":6020}]}
- PASS [round 22443419] delegate before the bell — refused with 6015 — got 6015 early failed: {"InstructionError":[0,{"Custom":6015}]}
- PASS [round 22443419] pot = entries — 24 players pot 240
- PASS [round 22443419] join after the bell — refused with 6016 — got 6016 join round failed: {"InstructionError":[0,{"Custom":6016}]}
- PASS [round 22443419] every seat live at the same entry — status 3
- PASS [round 22443419] cash out by a stranger — refused with 6021 — got 6021 stranger failed: {"InstructionError":[0,{"Custom":6021}]}
- PASS [round 22443419] ended by the crank at the bell — status 4, 140 ticks
- PASS [round 22443419] podium = best three positions — 20,23,4 vs 20,23,4
- PASS [round 22443419] prizes 50/30/20 sum to the pot — 120/72/48
- PASS [round 22443419] settled and every profile recorded — recorded 111111111111111111111111
- PASS [round 22443419] every balance moved by prize minus entry — 24/24
- PASS [packs] VRF packs drawn — Bronze,Bronze,Bronze,Bronze,-,-
- PASS [packs] a second pack while one waits — refused with 6011 — got 6011 open pack failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [dune.sol solo pack] live at the oracle price — status 2
- PASS [dune.sol solo pack] pack climb capped at its tier — top 1
- PASS [gecko_fx solo pack] live at the oracle price — status 2
- PASS [gecko_fx solo pack] pack climb capped at its tier — top 1
- PASS [ghibli_hunter solo pack] live at the oracle price — status 2
- PASS [ghibli_hunter solo pack] pack climb capped at its tier — top 1
- PASS [saffron301 solo pack] live at the oracle price — status 2
- PASS [saffron301 solo pack] pack climb capped at its tier — top 1
- PASS [dune.sol solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gecko_fx solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ghibli_hunter solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [saffron301 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [saffron301 solo pack] state committed to Solana equals the rollup — 10007525/10007525
- PASS [saffron301 solo pack] payout = position (pack: the gain only) — paid 0.007525 delta 0.007525
- PASS [saffron301 solo pack] profile records the climb — runs 7->8
- PASS [saffron301 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gecko_fx solo pack] state committed to Solana equals the rollup — 10045831/10045831
- PASS [gecko_fx solo pack] payout = position (pack: the gain only) — paid 0.045831 delta 0.045831
- PASS [gecko_fx solo pack] profile records the climb — runs 7->8
- PASS [ghibli_hunter solo pack] state committed to Solana equals the rollup — 10092086/10092086
- PASS [gecko_fx solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ghibli_hunter solo pack] payout = position (pack: the gain only) — paid 0.092086 delta 0.092086
- PASS [ghibli_hunter solo pack] profile records the climb — runs 7->8
- PASS [ghibli_hunter solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [dune.sol solo pack] expired by the crank at 60 s — status 5, 120 ticks
- PASS [dune.sol solo pack] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [dune.sol solo pack] state committed to Solana equals the rollup — 9996570/9996570
- PASS [dune.sol solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [dune.sol solo pack] profile records the climb — runs 7->8
- PASS [dune.sol solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}

## Run A: solo waves

Run 2026-11-23T22:29:49.314Z · program `29sucV8aHGufy1AWrKzgp9gBPRHBG9jSxAsSWXe7M2ov` · rollup https://devnet-eu.magicblock.app · 24 players · 2 solo waves · 2 rounds · 218 s

**338 / 342 checks passed.** Admin SOL 6.9810 -> 5.1060 (funding players).

Solo climbs settled: 48 (41 cashed, 7 expired), top leverage reached 4x.

Players (handles on chain): saffron301, dune.sol, ghibli_hunter, gecko_fx, bora.sol, wolfx, marrakechdesk77, bora_hands, amber625, rider88, lynx88, yield586, carrytrader.sol, gold.sol, sterlingrunner, yield935, basalt.sol, delta385, ember_fox, runner, quant24, atlas_pilot, deltawhale, copper_fox.

### Latencies

| step | n | median ms | max ms |
|---|---|---|---|
| fund players (8 per tx) | 4 | 1023 | 1044 |
| onboard (profile, faucet, session, allowance) | 20 | 1087 | 1398 |
| stake + delegate (Solana) | 50 | 1018 | 1374 |
| delegation visible on the rollup | 50 | 20 | 206 |
| begin + crank (rollup) | 50 | 373 | 501 |
| cash out + commit/undelegate (rollup) | 43 | 342 | 469 |
| undelegation back on Solana | 50 | 898 | 1166 |
| settle (Solana) | 50 | 1051 | 1394 |
| finish by a stranger (rollup) | 7 | 326 | 346 |
| open round + VRF request (Solana) | 2 | 577 | 577 |
| open pack + VRF request (Solana) | 2 | 1043 | 1043 |
| pack VRF callback | 2 | 1113 | 1113 |

### Checks

- PASS [deltawhale solo 1] live at the oracle price — status 2
- PASS [quant24 solo 1] live at the oracle price — status 2
- PASS [yield586 solo 1] live at the oracle price — status 2
- PASS [basalt.sol solo 1] live at the oracle price — status 2
- PASS [wolfx solo 1] live at the oracle price — status 2
- PASS [bora.sol solo 1] live at the oracle price — status 2
- PASS [yield935 solo 1] live at the oracle price — status 2
- PASS [runner solo 1] live at the oracle price — status 2
- PASS [carrytrader.sol solo 1] live at the oracle price — status 2
- PASS [gecko_fx solo 1] live at the oracle price — status 2
- PASS [bora_hands solo 1] live at the oracle price — status 2
- PASS [ember_fox solo 1] live at the oracle price — status 2
- PASS [amber625 solo 1] live at the oracle price — status 2
- PASS [ghibli_hunter solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [sterlingrunner solo 1] live at the oracle price — status 2
- PASS [rider88 solo 1] live at the oracle price — status 2
- PASS [saffron301 solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [copper_fox solo 1] live at the oracle price — status 2
- PASS [lynx88 solo 1] live at the oracle price — status 2
- PASS [delta385 solo 1] live at the oracle price — status 2
- PASS [dune.sol solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [gold.sol solo 1] live at the oracle price — status 2
- PASS [atlas_pilot solo 1] live at the oracle price — status 2
- PASS [ghibli_hunter solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [saffron301 solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [marrakechdesk77 solo 1] live at the oracle price — status 2
- PASS [dune.sol solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [ghibli_hunter solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [ghibli_hunter solo 1] live at the oracle price — status 2
- PASS [saffron301 solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [dune.sol solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [deltawhale solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ghibli_hunter solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [saffron301 solo 1] live at the oracle price — status 2
- PASS [dune.sol solo 1] live at the oracle price — status 2
- PASS [quant24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [basalt.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [yield586 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [wolfx solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ghibli_hunter solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [saffron301 solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [yield935 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [dune.sol solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [saffron301 solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gecko_fx solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [carrytrader.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [runner solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora_hands solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [amber625 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ember_fox solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [dune.sol solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [sterlingrunner solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [rider88 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [copper_fox solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [delta385 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx88 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gold.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [atlas_pilot solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [marrakechdesk77 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ghibli_hunter solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [saffron301 solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [dune.sol solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [ghibli_hunter solo 1] state committed to Solana equals the rollup — 24849279/24849279
- PASS [basalt.sol solo 1] state committed to Solana equals the rollup — 49999999/49999999
- PASS [sterlingrunner solo 1] state committed to Solana equals the rollup — 25000000/25000000
- PASS [basalt.sol solo 1] payout = position (pack: the gain only) — paid 49.999999 delta -0.000001
- PASS [basalt.sol solo 1] profile records the climb — runs 0->1
- PASS [ghibli_hunter solo 1] payout = position (pack: the gain only) — paid 24.849279 delta -0.150721
- PASS [ghibli_hunter solo 1] profile records the climb — runs 2->3
- PASS [basalt.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [marrakechdesk77 solo 1] state committed to Solana equals the rollup — 25000000/25000000
- PASS [ghibli_hunter solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [sterlingrunner solo 1] payout = position (pack: the gain only) — paid 25 delta 0
- PASS [sterlingrunner solo 1] profile records the climb — runs 0->1
- PASS [atlas_pilot solo 1] state committed to Solana equals the rollup — 25000000/25000000
- PASS [gecko_fx solo 1] state committed to Solana equals the rollup — 49885050/49885050
- PASS [sterlingrunner solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [marrakechdesk77 solo 1] payout = position (pack: the gain only) — paid 25 delta 0
- PASS [marrakechdesk77 solo 1] profile records the climb — runs 0->1
- PASS [copper_fox solo 1] state committed to Solana equals the rollup — 25000000/25000000
- PASS [lynx88 solo 1] state committed to Solana equals the rollup — 25310860/25310860
- PASS [atlas_pilot solo 1] payout = position (pack: the gain only) — paid 25 delta 0
- PASS [ember_fox solo 1] state committed to Solana equals the rollup — 50000000/50000000
- PASS [atlas_pilot solo 1] profile records the climb — runs 0->1
- PASS [marrakechdesk77 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gecko_fx solo 1] payout = position (pack: the gain only) — paid 49.88505 delta -0.11495
- PASS [gecko_fx solo 1] profile records the climb — runs 2->3
- PASS [lynx88 solo 1] payout = position (pack: the gain only) — paid 25.31086 delta 0.31086
- PASS [copper_fox solo 1] payout = position (pack: the gain only) — paid 25 delta 0
- PASS [lynx88 solo 1] profile records the climb — runs 0->1
- PASS [copper_fox solo 1] profile records the climb — runs 0->1
- PASS [delta385 solo 1] state committed to Solana equals the rollup — 50000000/50000000
- PASS [atlas_pilot solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [gecko_fx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ember_fox solo 1] payout = position (pack: the gain only) — paid 50 delta 0
- PASS [ember_fox solo 1] profile records the climb — runs 0->1
- PASS [copper_fox solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx88 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [delta385 solo 1] payout = position (pack: the gain only) — paid 50 delta 0
- PASS [delta385 solo 1] profile records the climb — runs 0->1
- PASS [ember_fox solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [runner solo 1] state committed to Solana equals the rollup — 49227287/49227287
- PASS [delta385 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [runner solo 1] payout = position (pack: the gain only) — paid 49.227287 delta -0.772713
- PASS [runner solo 1] profile records the climb — runs 0->1
- PASS [runner solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [wolfx solo 1] state committed to Solana equals the rollup — 99999999/99999999
- PASS [gold.sol solo 1] state committed to Solana equals the rollup — 99999999/99999999
- PASS [bora.sol solo 1] state committed to Solana equals the rollup — 50000000/50000000
- PASS [carrytrader.sol solo 1] state committed to Solana equals the rollup — 10000000/10000000
- PASS [wolfx solo 1] payout = position (pack: the gain only) — paid 99.999999 delta -0.000001
- PASS [wolfx solo 1] profile records the climb — runs 0->1
- PASS [gold.sol solo 1] payout = position (pack: the gain only) — paid 99.999999 delta -0.000001
- PASS [gold.sol solo 1] profile records the climb — runs 0->1
- PASS [wolfx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [dune.sol solo 1] state committed to Solana equals the rollup — 10175059/10175059
- PASS [bora.sol solo 1] payout = position (pack: the gain only) — paid 50 delta 0
- PASS [carrytrader.sol solo 1] payout = position (pack: the gain only) — paid 10 delta 0
- PASS [bora.sol solo 1] profile records the climb — runs 0->1
- PASS [carrytrader.sol solo 1] profile records the climb — runs 0->1
- PASS [gold.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora_hands solo 1] state committed to Solana equals the rollup — 99777880/99777880
- PASS [bora.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [carrytrader.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [dune.sol solo 1] payout = position (pack: the gain only) — paid 10.175059 delta 0.175059
- PASS [dune.sol solo 1] profile records the climb — runs 2->3
- PASS [deltawhale solo 1] state committed to Solana equals the rollup — 50000000/50000000
- PASS [bora_hands solo 1] payout = position (pack: the gain only) — paid 99.77788 delta -0.22212
- PASS [bora_hands solo 1] profile records the climb — runs 0->1
- PASS [amber625 solo 1] state committed to Solana equals the rollup — 9846490/9846490
- PASS [dune.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora_hands solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield935 solo 1] state committed to Solana equals the rollup — 49999999/49999999
- PASS [deltawhale solo 1] payout = position (pack: the gain only) — paid 50 delta 0
- PASS [amber625 solo 1] payout = position (pack: the gain only) — paid 9.84649 delta -0.15351
- PASS [deltawhale solo 1] profile records the climb — runs 0->1
- PASS [amber625 solo 1] profile records the climb — runs 0->1
- PASS [yield935 solo 1] payout = position (pack: the gain only) — paid 49.999999 delta -0.000001
- PASS [yield935 solo 1] profile records the climb — runs 0->1
- PASS [deltawhale solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [amber625 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield935 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [saffron301 solo 1] state committed to Solana equals the rollup — 49135888/49135888
- PASS [saffron301 solo 1] payout = position (pack: the gain only) — paid 49.135888 delta -0.864112
- PASS [saffron301 solo 1] profile records the climb — runs 2->3
- PASS [saffron301 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [quant24 solo 1] expired by the crank at 60 s — status 5, 121 ticks
- PASS [quant24 solo 1] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [rider88 solo 1] expired by the crank at 60 s — status 5, 120 ticks
- PASS [rider88 solo 1] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [yield586 solo 1] expired by the crank at 60 s — status 5, 121 ticks
- PASS [yield586 solo 1] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [quant24 solo 1] state committed to Solana equals the rollup — 10000000/10000000
- PASS [rider88 solo 1] state committed to Solana equals the rollup — 50000000/50000000
- PASS [yield586 solo 1] state committed to Solana equals the rollup — 108422722/108422722
- PASS [rider88 solo 1] payout = position (pack: the gain only) — paid 50 delta 0
- PASS [rider88 solo 1] profile records the climb — runs 0->1
- PASS [quant24 solo 1] payout = position (pack: the gain only) — paid 10 delta 0
- PASS [quant24 solo 1] profile records the climb — runs 0->1
- PASS [yield586 solo 1] payout = position (pack: the gain only) — paid 108.422722 delta 8.422722
- PASS [yield586 solo 1] profile records the climb — runs 0->1
- PASS [rider88 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [quant24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield586 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [delta385 solo 2] live at the oracle price — status 2
- PASS [ember_fox solo 2] live at the oracle price — status 2
- PASS [yield586 solo 2] live at the oracle price — status 2
- PASS [deltawhale solo 2] live at the oracle price — status 2
- PASS [amber625 solo 2] live at the oracle price — status 2
- PASS [runner solo 2] live at the oracle price — status 2
- PASS [lynx88 solo 2] live at the oracle price — status 2
- PASS [dune.sol solo 2] live at the oracle price — status 2
- PASS [carrytrader.sol solo 2] live at the oracle price — status 2
- PASS [rider88 solo 2] live at the oracle price — status 2
- PASS [marrakechdesk77 solo 2] live at the oracle price — status 2
- PASS [saffron301 solo 2] live at the oracle price — status 2
- PASS [gecko_fx solo 2] live at the oracle price — status 2
- PASS [wolfx solo 2] live at the oracle price — status 2
- PASS [bora_hands solo 2] live at the oracle price — status 2
- PASS [gold.sol solo 2] live at the oracle price — status 2
- PASS [copper_fox solo 2] live at the oracle price — status 2
- PASS [quant24 solo 2] live at the oracle price — status 2
- PASS [yield935 solo 2] live at the oracle price — status 2
- PASS [atlas_pilot solo 2] live at the oracle price — status 2
- PASS [bora.sol solo 2] live at the oracle price — status 2
- PASS [basalt.sol solo 2] live at the oracle price — status 2
- PASS [sterlingrunner solo 2] live at the oracle price — status 2
- PASS [ghibli_hunter solo 2] live at the oracle price — status 2
- PASS [ember_fox solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [delta385 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [deltawhale solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [yield586 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [amber625 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [runner solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx88 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [dune.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gecko_fx solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [rider88 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [marrakechdesk77 solo 2] crank ticks on the rollup — 6 ticks in 3 s
- PASS [bora_hands solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [saffron301 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [carrytrader.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [wolfx solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gold.sol solo 2] crank ticks on the rollup — 6 ticks in 3 s
- PASS [copper_fox solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [quant24 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [atlas_pilot solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [yield935 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [basalt.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [ghibli_hunter solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [sterlingrunner solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [gold.sol solo 2] state committed to Solana equals the rollup — 50000000/50000000
- PASS [gold.sol solo 2] payout = position (pack: the gain only) — paid 50 delta 0
- PASS [gold.sol solo 2] profile records the climb — runs 1->2
- PASS [bora_hands solo 2] state committed to Solana equals the rollup — 24994656/24994656
- PASS [gold.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [sterlingrunner solo 2] state committed to Solana equals the rollup — 49923580/49923580
- PASS [bora_hands solo 2] payout = position (pack: the gain only) — paid 24.994656 delta -0.005344
- PASS [bora_hands solo 2] profile records the climb — runs 1->2
- PASS [sterlingrunner solo 2] payout = position (pack: the gain only) — paid 49.92358 delta -0.07642
- PASS [sterlingrunner solo 2] profile records the climb — runs 1->2
- PASS [bora_hands solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [sterlingrunner solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield586 solo 2] state committed to Solana equals the rollup — 9987992/9987992
- PASS [quant24 solo 2] state committed to Solana equals the rollup — 99698905/99698905
- PASS [rider88 solo 2] state committed to Solana equals the rollup — 24976414/24976414
- PASS [yield586 solo 2] payout = position (pack: the gain only) — paid 9.987992 delta -0.012008
- PASS [yield586 solo 2] profile records the climb — runs 1->2
- PASS [atlas_pilot solo 2] state committed to Solana equals the rollup — 99992389/99992389
- PASS [bora.sol solo 2] state committed to Solana equals the rollup — 25192228/25192228
- PASS [deltawhale solo 2] state committed to Solana equals the rollup — 25000000/25000000
- PASS [quant24 solo 2] payout = position (pack: the gain only) — paid 99.698905 delta -0.301095
- PASS [quant24 solo 2] profile records the climb — runs 1->2
- PASS [rider88 solo 2] payout = position (pack: the gain only) — paid 24.976414 delta -0.023586
- PASS [rider88 solo 2] profile records the climb — runs 1->2
- PASS [yield586 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora.sol solo 2] payout = position (pack: the gain only) — paid 25.192228 delta 0.192228
- PASS [atlas_pilot solo 2] payout = position (pack: the gain only) — paid 99.992389 delta -0.007611
- PASS [deltawhale solo 2] payout = position (pack: the gain only) — paid 25 delta 0
- PASS [bora.sol solo 2] profile records the climb — runs 1->2
- PASS [atlas_pilot solo 2] profile records the climb — runs 1->2
- PASS [deltawhale solo 2] profile records the climb — runs 1->2
- PASS [rider88 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [quant24 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [deltawhale solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [atlas_pilot solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ghibli_hunter solo 2] state committed to Solana equals the rollup — 49971322/49971322
- PASS [gecko_fx solo 2] state committed to Solana equals the rollup — 25000034/25000034
- PASS [marrakechdesk77 solo 2] state committed to Solana equals the rollup — 100000000/100000000
- PASS [copper_fox solo 2] state committed to Solana equals the rollup — 10000055/10000055
- PASS [ghibli_hunter solo 2] payout = position (pack: the gain only) — paid 49.971322 delta -0.028678
- PASS [ghibli_hunter solo 2] profile records the climb — runs 3->4
- PASS [gecko_fx solo 2] payout = position (pack: the gain only) — paid 25.000034 delta 0.000034
- PASS [gecko_fx solo 2] profile records the climb — runs 3->4
- PASS [carrytrader.sol solo 2] state committed to Solana equals the rollup — 100302988/100302988
- PASS [ghibli_hunter solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [marrakechdesk77 solo 2] payout = position (pack: the gain only) — paid 100 delta 0
- PASS [marrakechdesk77 solo 2] profile records the climb — runs 1->2
- PASS [delta385 solo 2] state committed to Solana equals the rollup — 49973031/49973031
- PASS [gecko_fx solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [basalt.sol solo 2] state committed to Solana equals the rollup — 25014240/25014240
- PASS [copper_fox solo 2] payout = position (pack: the gain only) — paid 10.000055 delta 0.000055
- PASS [copper_fox solo 2] profile records the climb — runs 1->2
- PASS [carrytrader.sol solo 2] payout = position (pack: the gain only) — paid 100.302988 delta 0.302988
- PASS [carrytrader.sol solo 2] profile records the climb — runs 1->2
- PASS [wolfx solo 2] state committed to Solana equals the rollup — 10000159/10000159
- PASS [copper_fox solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [marrakechdesk77 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [carrytrader.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [basalt.sol solo 2] payout = position (pack: the gain only) — paid 25.01424 delta 0.01424
- PASS [delta385 solo 2] payout = position (pack: the gain only) — paid 49.973031 delta -0.026969
- PASS [basalt.sol solo 2] profile records the climb — runs 1->2
- PASS [delta385 solo 2] profile records the climb — runs 1->2
- PASS [dune.sol solo 2] state committed to Solana equals the rollup — 10005357/10005357
- PASS [wolfx solo 2] payout = position (pack: the gain only) — paid 10.000159 delta 0.000159
- PASS [wolfx solo 2] profile records the climb — runs 1->2
- PASS [basalt.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [delta385 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [wolfx solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [dune.sol solo 2] payout = position (pack: the gain only) — paid 10.005357 delta 0.005357
- PASS [dune.sol solo 2] profile records the climb — runs 3->4
- PASS [lynx88 solo 2] state committed to Solana equals the rollup — 25000000/25000000
- PASS [dune.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ember_fox solo 2] state committed to Solana equals the rollup — 10034170/10034170
- PASS [lynx88 solo 2] payout = position (pack: the gain only) — paid 25 delta 0
- PASS [lynx88 solo 2] profile records the climb — runs 1->2
- PASS [ember_fox solo 2] payout = position (pack: the gain only) — paid 10.03417 delta 0.03417
- PASS [ember_fox solo 2] profile records the climb — runs 1->2
- PASS [lynx88 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [ember_fox solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [amber625 solo 2] expired by the crank at 60 s — status 5, 120 ticks
- PASS [amber625 solo 2] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [saffron301 solo 2] expired by the crank at 60 s — status 5, 120 ticks
- PASS [saffron301 solo 2] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [runner solo 2] expired by the crank at 60 s — status 5, 120 ticks
- PASS [runner solo 2] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [saffron301 solo 2] state committed to Solana equals the rollup — 90139941/90139941
- PASS [yield935 solo 2] expired by the crank at 60 s — status 5, 121 ticks
- PASS [yield935 solo 2] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [runner solo 2] state committed to Solana equals the rollup — 10000000/10000000
- PASS [amber625 solo 2] state committed to Solana equals the rollup — 24581646/24581646
- PASS [yield935 solo 2] state committed to Solana equals the rollup — 44480859/44480859
- PASS [saffron301 solo 2] payout = position (pack: the gain only) — paid 90.139941 delta -9.860059
- PASS [saffron301 solo 2] profile records the climb — runs 3->4
- PASS [amber625 solo 2] payout = position (pack: the gain only) — paid 24.581646 delta -0.418354
- PASS [runner solo 2] payout = position (pack: the gain only) — paid 10 delta 0
- PASS [amber625 solo 2] profile records the climb — runs 1->2
- PASS [saffron301 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [runner solo 2] profile records the climb — runs 1->2
- PASS [yield935 solo 2] payout = position (pack: the gain only) — paid 44.480859 delta -5.519141
- PASS [yield935 solo 2] profile records the climb — runs 1->2
- PASS [amber625 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [runner solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield935 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [refusals] stake above 100 tUSDC — refused with 6009 — got 6009 big failed: {"InstructionError":[0,{"Custom":6009}]}
- PASS [refusals] a session key acting for another wallet — refused with 6000 — got 6000 impersonate failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a price pushed by a player — refused with 6000 — got 6000 push failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a pack climb without a pack — refused with 6023 — got 6023 nopack failed: {"InstructionError":[0,{"Custom":6023}]}
- PASS [refusals] faucet twice in a row — refused with 6006 — got 6006 faucet failed: {"InstructionError":[1,{"Custom":6006}]}
- FAIL [round 22443415] open with no market — refused with 6007 — got 3007 nomask failed: {"InstructionError":[0,{"Custom":3007}]}
- FAIL [round] round completed — open round failed: {"InstructionError":[0,{"Custom":3007}]}
- FAIL [round 22443415] open with no market — refused with 6007 — got 3007 nomask failed: {"InstructionError":[0,{"Custom":3007}]}
- FAIL [round] round completed — open round failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [packs] VRF packs drawn — -,-,-,-,Diamond,Silver
- PASS [packs] a second pack while one waits — refused with 6011 — got 6011 open pack failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [bora.sol solo pack] live at the oracle price — status 2
- PASS [bora.sol solo pack] pack climb capped at its tier — top 6
- PASS [wolfx solo pack] live at the oracle price — status 2
- PASS [wolfx solo pack] pack climb capped at its tier — top 2
- PASS [bora.sol solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [wolfx solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [bora.sol solo pack] state committed to Solana equals the rollup — 9999897/9999897
- PASS [bora.sol solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [bora.sol solo pack] profile records the climb — runs 2->3
- PASS [bora.sol solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [wolfx solo pack] state committed to Solana equals the rollup — 10001308/10001308
- PASS [wolfx solo pack] payout = position (pack: the gain only) — paid 0.001308 delta 0.001308
- PASS [wolfx solo pack] profile records the climb — runs 2->3
- PASS [wolfx solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}