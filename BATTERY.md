# Battery report

On-chain battery on Solana devnet + MagicBlock devnet-eu (`npm run battery -- 24 2 2`): 24 players with realistic handles, each with its own MagicBlock session key, playing at the same time.

| Run | Program | What | Checks |
|---|---|---|---|
| E, 24 Nov 2026 | **current deployment** `BS6874Pq…`, GMEx upgrade | 8 simultaneous solo climbs on all five markets (GMEx included), refusals, one 8-seat round drawn by VRF on GMEx, VRF packs (`BATTERY_FUND_MIN=0.01 npm run battery -- 8 1 1`: no SOL top-up, the players' session keys were still fuelled) | **132 / 132** |
| D, 24 Nov 2026 | `BS6874Pq…` before the GMEx upgrade, from Siroclimb's own deployer | 48 simultaneous solo climbs, refusals, two full 24-seat rounds (both TSLAx, drawn by VRF), VRF packs and their free climbs | **404 / 404** |
| C, 24 Nov 2026 | previous program (closed), with on-chain market hours | same | 400 / 400 |
| B, 23 Nov 2026 | previous program, first RWA build | two full 24-seat rounds | 66 / 67 (FINDINGS #7, test bug) |
| A, 23 Nov 2026 | previous program, first RWA build | 48 simultaneous solo climbs, packs | 338 / 342 (FINDINGS #6, stuck round slot) |

The players of runs D and E are keypairs funded only by Siroclimb's deployer. Runs A to D are in the git history of this file.

## Run E

Run 2026-11-24T18:07:50.854Z · program `BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ` · rollup https://devnet-eu.magicblock.app · 8 players · 1 solo waves · 1 rounds · 251 s

**132 / 132 checks passed.** Admin SOL 4.4595 -> 4.4595 (funding players).

Solo climbs settled: 8 (6 cashed, 2 expired), top leverage reached 4x.

Players (handles on chain): candlerider_gold, candleowl24, mistrallynx, levechequeen, harmattan_whale, lynx24, nvidiasmith24, harmattan156.

## Latencies

| step | n | median ms | max ms |
|---|---|---|---|
| stake + delegate (Solana) | 14 | 1052 | 1368 |
| delegation visible on the rollup | 14 | 19 | 504 |
| begin + crank (rollup) | 14 | 388 | 921 |
| cash out + commit/undelegate (rollup) | 11 | 310 | 418 |
| undelegation back on Solana | 14 | 667 | 3056 |
| settle (Solana) | 14 | 1084 | 4991 |
| finish by a stranger (rollup) | 3 | 351 | 353 |
| open round + VRF request (Solana) | 1 | 1061 | 1061 |
| round market VRF callback | 1 | 456 | 456 |
| join (Solana) | 8 | 1084 | 1209 |
| delegate round (Solana) | 1 | 1037 | 1037 |
| go live + crank (rollup) | 1 | 400 | 400 |
| round cash out (rollup) | 4 | 5239 | 10501 |
| finish round + commit/undelegate (rollup) | 1 | 5708 | 5708 |
| round back on Solana | 1 | 140 | 140 |
| settle round (Solana) | 1 | 1298 | 1298 |
| record profiles (6 per tx) | 1 | 2394 | 2394 |
| open pack + VRF request (Solana) | 6 | 979 | 1061 |
| pack VRF callback | 6 | 756 | 1113 |

## Checks

- PASS [candleowl24 solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [lynx24 solo 1] live at the oracle price — status 2
- PASS [harmattan156 solo 1] live at the oracle price — status 2
- PASS [levechequeen solo 1] live at the oracle price — status 2
- PASS [candleowl24 solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candlerider_gold solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [harmattan_whale solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [nvidiasmith24 solo 1] live at the oracle price — status 2
- PASS [candleowl24 solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [mistrallynx solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candlerider_gold solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] live at the oracle price — status 2
- PASS [candleowl24 solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [mistrallynx solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candlerider_gold solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] live at the oracle price — status 2
- PASS [candlerider_gold solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [candlerider_gold solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [lynx24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan156 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [nvidiasmith24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [candlerider_gold solo 1] crank ticks on the rollup — 8 ticks in 3 s
- PASS [mistrallynx solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [harmattan156 solo 1] state committed to Solana equals the rollup — 9439425/9439425
- PASS [harmattan156 solo 1] payout = position (pack: the gain only) — paid 9.439425 delta -0.560575
- PASS [harmattan156 solo 1] profile records the climb — runs 4->5
- PASS [harmattan156 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] state committed to Solana equals the rollup — 48056566/48056566
- PASS [candleowl24 solo 1] state committed to Solana equals the rollup — 47919998/47919998
- PASS [mistrallynx solo 1] payout = position (pack: the gain only) — paid 48.056566 delta -1.943434
- PASS [mistrallynx solo 1] profile records the climb — runs 5->6
- PASS [harmattan_whale solo 1] state committed to Solana equals the rollup — 10133095/10133095
- PASS [candleowl24 solo 1] payout = position (pack: the gain only) — paid 47.919998 delta -2.080002
- PASS [candleowl24 solo 1] profile records the climb — runs 5->6
- PASS [mistrallynx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candleowl24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo 1] payout = position (pack: the gain only) — paid 10.133095 delta 0.133095
- PASS [harmattan_whale solo 1] profile records the climb — runs 5->6
- PASS [nvidiasmith24 solo 1] state committed to Solana equals the rollup — 49111982/49111982
- PASS [harmattan_whale solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo 1] state committed to Solana equals the rollup — 26634972/26634972
- PASS [nvidiasmith24 solo 1] payout = position (pack: the gain only) — paid 49.111982 delta -0.888018
- PASS [nvidiasmith24 solo 1] profile records the climb — runs 4->5
- PASS [nvidiasmith24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo 1] payout = position (pack: the gain only) — paid 26.634972 delta 1.634972
- PASS [lynx24 solo 1] profile records the climb — runs 5->6
- PASS [lynx24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo 1] expired by the crank at 60 s — status 5, 120 ticks
- PASS [levechequeen solo 1] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [levechequeen solo 1] state committed to Solana equals the rollup — 106878394/106878394
- PASS [levechequeen solo 1] payout = position (pack: the gain only) — paid 106.878394 delta 6.878394
- PASS [levechequeen solo 1] profile records the climb — runs 5->6
- PASS [candlerider_gold solo 1] expired by the crank at 60 s — status 5, 120 ticks
- PASS [candlerider_gold solo 1] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [levechequeen solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold solo 1] state committed to Solana equals the rollup — 52347647/52347647
- PASS [candlerider_gold solo 1] payout = position (pack: the gain only) — paid 52.347647 delta 2.347647
- PASS [candlerider_gold solo 1] profile records the climb — runs 5->6
- PASS [candlerider_gold solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [refusals] stake above 100 tUSDC — refused with 6009 — got 6009 big failed: {"InstructionError":[0,{"Custom":6009}]}
- PASS [refusals] a session key acting for another wallet — refused with 6000 — got 6000 impersonate failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a market that does not exist — refused with 6007 — got 6007 badasset failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [refusals] a pack climb without a pack — refused with 6023 — got 6023 nopack failed: {"InstructionError":[0,{"Custom":6023}]}
- PASS [refusals] faucet twice in a row — refused with 6006 — got 6006 faucet failed: {"InstructionError":[1,{"Custom":6006}]}
- PASS [round 22444297] open with no market — refused with 6007 — got 6007 nomask failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [round 22444297] VRF drew an open market — asset 4
- PASS [round 22444297] all 8 players seated at once — 8 seated; 
- PASS [round 22444297] the same player twice — refused with 6020 — got 6020 join round failed: {"InstructionError":[0,{"Custom":6020}]}
- PASS [round 22444297] delegate before the bell — refused with 6015 — got 6015 early failed: {"InstructionError":[0,{"Custom":6015}]}
- PASS [round 22444297] pot = entries — 8 players pot 80
- PASS [round 22444297] join after the bell — refused with 6016 — got 6016 join round failed: {"InstructionError":[0,{"Custom":6016}]}
- PASS [round 22444297] every seat live at the same entry — status 3
- PASS [round 22444297] cash out by a stranger — refused with 6021 — got 6021 stranger failed: {"InstructionError":[0,{"Custom":6021}]}
- PASS [round 22444297] ended by the crank at the bell — status 4, 124 ticks
- PASS [round 22444297] podium = best three positions — 6,4,7 vs 6,4,7
- PASS [round 22444297] prizes 50/30/20 sum to the pot — 40/24/16
- PASS [round 22444297] settled and every profile recorded — recorded 11111111
- PASS [round 22444297] every balance moved by prize minus entry — 8/8
- PASS [packs] VRF packs drawn — Bronze,Gold,Gold,Gold,Silver,Bronze
- PASS [packs] a second pack while one waits — refused with 6011 — got 6011 open pack failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo pack] live at the oracle price — status 2
- PASS [levechequeen solo pack] pack climb capped at its tier — top 4
- PASS [lynx24 solo pack] live at the oracle price — status 2
- PASS [lynx24 solo pack] pack climb capped at its tier — top 1
- PASS [mistrallynx solo pack] live at the oracle price — status 2
- PASS [mistrallynx solo pack] pack climb capped at its tier — top 4
- PASS [harmattan_whale solo pack] live at the oracle price — status 2
- PASS [harmattan_whale solo pack] pack climb capped at its tier — top 2
- PASS [candleowl24 solo pack] live at the oracle price — status 2
- PASS [candleowl24 solo pack] pack climb capped at its tier — top 4
- PASS [candlerider_gold solo pack] live at the oracle price — status 2
- PASS [candlerider_gold solo pack] pack climb capped at its tier — top 1
- PASS [levechequeen solo pack] crank ticks on the rollup — 8 ticks in 3 s
- PASS [lynx24 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [mistrallynx solo pack] crank ticks on the rollup — 8 ticks in 3 s
- PASS [harmattan_whale solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo pack] state committed to Solana equals the rollup — 9892162/9892162
- PASS [candlerider_gold solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [candlerider_gold solo pack] profile records the climb — runs 7->8
- PASS [mistrallynx solo pack] state committed to Solana equals the rollup — 9851943/9851943
- PASS [candlerider_gold solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [mistrallynx solo pack] profile records the climb — runs 7->8
- PASS [candleowl24 solo pack] state committed to Solana equals the rollup — 10215372/10215372
- PASS [mistrallynx solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo pack] state committed to Solana equals the rollup — 10322469/10322469
- PASS [candleowl24 solo pack] payout = position (pack: the gain only) — paid 0.215372 delta 0.215372
- PASS [candleowl24 solo pack] profile records the climb — runs 7->8
- PASS [lynx24 solo pack] payout = position (pack: the gain only) — paid 0.322469 delta 0.322469
- PASS [lynx24 solo pack] profile records the climb — runs 7->8
- PASS [candleowl24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo pack] state committed to Solana equals the rollup — 9761637/9761637
- PASS [harmattan_whale solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [harmattan_whale solo pack] profile records the climb — runs 7->8
- PASS [harmattan_whale solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo pack] expired by the crank at 60 s — status 5, 121 ticks
- PASS [levechequeen solo pack] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [levechequeen solo pack] state committed to Solana equals the rollup — 8581427/8581427
- PASS [levechequeen solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [levechequeen solo pack] profile records the climb — runs 7->8
- PASS [levechequeen solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
