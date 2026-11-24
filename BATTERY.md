# Battery report

On-chain battery on Solana devnet + MagicBlock devnet-eu (`npm run battery -- 24 2`): 24 players with realistic handles, each with its own MagicBlock session key, playing at the same time.

| Run | Program | What | Checks |
|---|---|---|---|
| F, 24 Nov 2026 | **current deployment** `BS6874Pq…`, solo only (rounds removed) | 8 simultaneous solo climbs on all five markets, refusals, VRF packs and their free climbs (`npm run battery -- 8 1`, players and session keys topped up only below 0.01 SOL) | **118 / 118** |
| E, 24 Nov 2026 | `BS6874Pq…`, GMEx upgrade | 8 simultaneous solo climbs on all five markets (GMEx included), refusals, one 8-seat round drawn by VRF on GMEx, VRF packs (`BATTERY_FUND_MIN=0.01 npm run battery -- 8 1 1`: no SOL top-up, the players' session keys were still fuelled) | **132 / 132** |
| D, 24 Nov 2026 | `BS6874Pq…` before the GMEx upgrade, from Siroclimb's own deployer | 48 simultaneous solo climbs, refusals, two full 24-seat rounds (both TSLAx, drawn by VRF), VRF packs and their free climbs | **404 / 404** |
| C, 24 Nov 2026 | previous program (closed), with on-chain market hours | same | 400 / 400 |
| B, 23 Nov 2026 | previous program, first RWA build | two full 24-seat rounds | 66 / 67 (FINDINGS #7, test bug) |
| A, 23 Nov 2026 | previous program, first RWA build | 48 simultaneous solo climbs, packs | 338 / 342 (FINDINGS #6, stuck round slot) |

The players of runs D to F are keypairs funded only by Siroclimb's deployer. Runs A to E are in the git history of this file; since run F a battery replaces only the latest run section.


## Run F

Run 2026-11-24T18:25:09.631Z · program `BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ` · rollup https://devnet-eu.magicblock.app · 8 players · 1 solo waves · 146 s

**118 / 118 checks passed.** Admin SOL 4.5134 -> 4.5134 (funding players).

Solo climbs settled: 8 (7 cashed, 1 expired), top leverage reached 4x.

Players (handles on chain): candlerider_gold, candleowl24, mistrallynx, levechequeen, harmattan_whale, lynx24, nvidiasmith24, harmattan156.

## Latencies

| step | n | median ms | max ms |
|---|---|---|---|
| stake + delegate (Solana) | 14 | 1230 | 1333 |
| delegation visible on the rollup | 14 | 68 | 2583 |
| begin + crank (rollup) | 14 | 317 | 436 |
| cash out + commit/undelegate (rollup) | 11 | 352 | 432 |
| undelegation back on Solana | 14 | 993 | 3150 |
| settle (Solana) | 14 | 1040 | 1096 |
| finish by a stranger (rollup) | 3 | 353 | 360 |
| open pack + VRF request (Solana) | 6 | 1022 | 1047 |
| pack VRF callback | 6 | 704 | 789 |

## Checks

- PASS [lynx24 solo 1] live at the oracle price — status 2
- PASS [harmattan156 solo 1] live at the oracle price — status 2
- PASS [nvidiasmith24 solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [candlerider_gold solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [levechequeen solo 1] live at the oracle price — status 2
- PASS [harmattan_whale solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candlerider_gold solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [mistrallynx solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candlerider_gold solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [mistrallynx solo 1] live at the oracle price — status 2
- PASS [lynx24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [candleowl24 solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [candlerider_gold solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [mistrallynx solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan156 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [nvidiasmith24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo 1] crank ticks on the rollup — 6 ticks in 3 s
- PASS [candleowl24 solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] live at the oracle price — status 2
- PASS [candleowl24 solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [candleowl24 solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [candlerider_gold solo 1] crank ticks on the rollup — 8 ticks in 3 s
- PASS [candleowl24 solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [candlerider_gold solo 1] state committed to Solana equals the rollup — 10085722/10085722
- PASS [levechequeen solo 1] state committed to Solana equals the rollup — 50636066/50636066
- PASS [levechequeen solo 1] payout = position (pack: the gain only) — paid 50.636066 delta 0.636066
- PASS [candlerider_gold solo 1] payout = position (pack: the gain only) — paid 10.085722 delta 0.085722
- PASS [harmattan156 solo 1] state committed to Solana equals the rollup — 24432921/24432921
- PASS [candlerider_gold solo 1] profile records the climb — runs 8->9
- PASS [levechequeen solo 1] profile records the climb — runs 8->9
- PASS [candlerider_gold solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan156 solo 1] payout = position (pack: the gain only) — paid 24.432921 delta -0.567079
- PASS [harmattan156 solo 1] profile records the climb — runs 6->7
- PASS [harmattan156 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo 1] state committed to Solana equals the rollup — 50196373/50196373
- PASS [nvidiasmith24 solo 1] state committed to Solana equals the rollup — 51703020/51703020
- PASS [harmattan_whale solo 1] payout = position (pack: the gain only) — paid 50.196373 delta 0.196373
- PASS [harmattan_whale solo 1] profile records the climb — runs 8->9
- PASS [lynx24 solo 1] state committed to Solana equals the rollup — 101415203/101415203
- PASS [nvidiasmith24 solo 1] payout = position (pack: the gain only) — paid 51.70302 delta 1.70302
- PASS [nvidiasmith24 solo 1] profile records the climb — runs 6->7
- PASS [harmattan_whale solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [nvidiasmith24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo 1] payout = position (pack: the gain only) — paid 101.415203 delta 1.415203
- PASS [lynx24 solo 1] profile records the climb — runs 8->9
- PASS [lynx24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candleowl24 solo 1] state committed to Solana equals the rollup — 9816731/9816731
- PASS [candleowl24 solo 1] payout = position (pack: the gain only) — paid 9.816731 delta -0.183269
- PASS [candleowl24 solo 1] profile records the climb — runs 8->9
- PASS [candleowl24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] expired by the crank at 60 s — status 5, 120 ticks
- PASS [mistrallynx solo 1] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [mistrallynx solo 1] state committed to Solana equals the rollup — 92157413/92157413
- PASS [mistrallynx solo 1] payout = position (pack: the gain only) — paid 92.157413 delta -7.842587
- PASS [mistrallynx solo 1] profile records the climb — runs 8->9
- PASS [mistrallynx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [refusals] stake above 100 tUSDC — refused with 6009 — got 6009 big failed: {"InstructionError":[0,{"Custom":6009}]}
- PASS [refusals] a session key acting for another wallet — refused with 6000 — got 6000 impersonate failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a market that does not exist — refused with 6007 — got 6007 badasset failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [refusals] a pack climb without a pack — refused with 6023 — got 6023 nopack failed: {"InstructionError":[0,{"Custom":6023}]}
- PASS [refusals] faucet twice in a row — refused with 6006 — got 6006 faucet failed: {"InstructionError":[1,{"Custom":6006}]}
- PASS [packs] VRF packs drawn — Diamond,Gold,Gold,Bronze,Silver,Bronze
- PASS [packs] a second pack while one waits — refused with 6011 — got 6011 open pack failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo pack] live at the oracle price — status 2
- PASS [levechequeen solo pack] pack climb capped at its tier — top 1
- PASS [candlerider_gold solo pack] live at the oracle price — status 2
- PASS [candlerider_gold solo pack] pack climb capped at its tier — top 6
- PASS [candleowl24 solo pack] live at the oracle price — status 2
- PASS [candleowl24 solo pack] pack climb capped at its tier — top 4
- PASS [lynx24 solo pack] live at the oracle price — status 2
- PASS [lynx24 solo pack] pack climb capped at its tier — top 1
- PASS [mistrallynx solo pack] live at the oracle price — status 2
- PASS [mistrallynx solo pack] pack climb capped at its tier — top 4
- PASS [harmattan_whale solo pack] live at the oracle price — status 2
- PASS [harmattan_whale solo pack] pack climb capped at its tier — top 2
- PASS [levechequeen solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo pack] crank ticks on the rollup — 6 ticks in 3 s
- PASS [lynx24 solo pack] crank ticks on the rollup — 6 ticks in 3 s
- PASS [mistrallynx solo pack] crank ticks on the rollup — 6 ticks in 3 s
- PASS [harmattan_whale solo pack] crank ticks on the rollup — 5 ticks in 3 s
- PASS [candleowl24 solo pack] state committed to Solana equals the rollup — 9925251/9925251
- PASS [candleowl24 solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [candleowl24 solo pack] profile records the climb — runs 9->10
- PASS [candleowl24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo pack] state committed to Solana equals the rollup — 10124327/10124327
- PASS [levechequeen solo pack] payout = position (pack: the gain only) — paid 0.124327 delta 0.124327
- PASS [levechequeen solo pack] profile records the climb — runs 9->10
- PASS [levechequeen solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo pack] state committed to Solana equals the rollup — 10192404/10192404
- PASS [harmattan_whale solo pack] state committed to Solana equals the rollup — 10151378/10151378
- PASS [lynx24 solo pack] payout = position (pack: the gain only) — paid 0.192404 delta 0.192404
- PASS [lynx24 solo pack] profile records the climb — runs 9->10
- PASS [harmattan_whale solo pack] payout = position (pack: the gain only) — paid 0.151378 delta 0.151378
- PASS [harmattan_whale solo pack] profile records the climb — runs 9->10
- PASS [harmattan_whale solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold solo pack] expired by the crank at 60 s — status 5, 119 ticks
- PASS [candlerider_gold solo pack] crank ticked ~2/s for the whole climb — 119 ticks
- PASS [candlerider_gold solo pack] state committed to Solana equals the rollup — 10482982/10482982
- PASS [mistrallynx solo pack] expired by the crank at 60 s — status 5, 118 ticks
- PASS [mistrallynx solo pack] crank ticked ~2/s for the whole climb — 118 ticks
- PASS [candlerider_gold solo pack] payout = position (pack: the gain only) — paid 0.482982 delta 0.482982
- PASS [candlerider_gold solo pack] profile records the climb — runs 9->10
- PASS [candlerider_gold solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo pack] state committed to Solana equals the rollup — 8566405/8566405
- PASS [mistrallynx solo pack] payout = position (pack: the gain only) — paid 0 delta 0
- PASS [mistrallynx solo pack] profile records the climb — runs 9->10
- PASS [mistrallynx solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
