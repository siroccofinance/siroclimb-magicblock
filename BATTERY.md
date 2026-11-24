# Battery report

On-chain battery on Solana devnet + MagicBlock devnet-eu (`npm run battery -- 24 2`): 24 players with realistic handles, each with its own MagicBlock session key, playing at the same time.

| Run | Program | What | Checks |
|---|---|---|---|
| G, 24 Nov 2026 | **current deployment** `BS6874Pq…`, Sirocco Reserve | 3 lenders deposit and withdraw at the share price, 8 simultaneous solo climbs on all five markets each reserving liquidity and a borrow line and paying its borrow cost, refusals, VRF packs funded by the reserve, the reserve square at the end (`npm run battery -- 8 1`) | **156 / 156** |
| F, 24 Nov 2026 | `BS6874Pq…`, solo only (rounds removed) | 8 simultaneous solo climbs on all five markets, refusals, VRF packs and their free climbs (`npm run battery -- 8 1`, players and session keys topped up only below 0.01 SOL) | **118 / 118** |
| E, 24 Nov 2026 | `BS6874Pq…`, GMEx upgrade | 8 simultaneous solo climbs on all five markets (GMEx included), refusals, one 8-seat round drawn by VRF on GMEx, VRF packs (`BATTERY_FUND_MIN=0.01 npm run battery -- 8 1 1`: no SOL top-up, the players' session keys were still fuelled) | **132 / 132** |
| D, 24 Nov 2026 | `BS6874Pq…` before the GMEx upgrade, from Siroclimb's own deployer | 48 simultaneous solo climbs, refusals, two full 24-seat rounds (both TSLAx, drawn by VRF), VRF packs and their free climbs | **404 / 404** |
| C, 24 Nov 2026 | previous program (closed), with on-chain market hours | same | 400 / 400 |
| B, 23 Nov 2026 | previous program, first RWA build | two full 24-seat rounds | 66 / 67 (FINDINGS #7, test bug) |
| A, 23 Nov 2026 | previous program, first RWA build | 48 simultaneous solo climbs, packs | 338 / 342 (FINDINGS #6, stuck round slot) |

The players of runs D to G are keypairs funded only by Siroclimb's deployer. Runs A to F are in the git history of this file; since run F a battery replaces only the latest run section.



## Run G

Run 2026-11-24T18:44:03.383Z · program `BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ` · rollup https://devnet-eu.magicblock.app · 8 players · 1 solo waves · 153 s

**156 / 156 checks passed.** Admin SOL 4.3585 -> 4.3585 (funding players).

Sirocco Reserve: 14 climbs drew on it, 0.5402 tUSDC of borrow costs paid, net result for lenders 2.28 tUSDC; share price 1.000000.

Solo climbs settled: 8 (7 cashed, 1 expired), top leverage reached 4x.

Players (handles on chain): candlerider_gold, candleowl24, mistrallynx, levechequeen, harmattan_whale, lynx24, nvidiasmith24, harmattan156.

## Latencies

| step | n | median ms | max ms |
|---|---|---|---|
| deposit (Solana) | 3 | 964 | 1226 |
| stake + delegate (Solana) | 14 | 958 | 1225 |
| delegation visible on the rollup | 14 | 18 | 224 |
| begin + crank (rollup) | 14 | 313 | 394 |
| cash out + commit/undelegate (rollup) | 11 | 348 | 438 |
| undelegation back on Solana | 14 | 935 | 1817 |
| settle (Solana) | 14 | 1025 | 1057 |
| finish by a stranger (rollup) | 3 | 343 | 347 |
| open pack + VRF request (Solana) | 6 | 1056 | 1092 |
| pack VRF callback | 6 | 747 | 866 |
| withdraw (Solana) | 3 | 948 | 1008 |

## Checks

- PASS [candlerider_gold lends] deposit 50 tUSDC: shares at the share price — 50.000001 shares, expected 50.000001
- PASS [candleowl24 lends] deposit 20 tUSDC: shares at the share price — 20 shares, expected 20
- PASS [mistrallynx lends] deposit 35 tUSDC: shares at the share price — 35.000001 shares, expected 35.000001
- PASS [lenders] withdraw more shares than held — refused with 6029 — got 6029 withdraw failed: {"InstructionError":[1,{"Custom":6029}]}
- PASS [candleowl24 solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [nvidiasmith24 solo 1] live at the oracle price — status 2
- PASS [nvidiasmith24 solo 1] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [harmattan_whale solo 1] live at the oracle price — status 2
- PASS [harmattan_whale solo 1] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [levechequeen solo 1] live at the oracle price — status 2
- PASS [levechequeen solo 1] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [lynx24 solo 1] live at the oracle price — status 2
- PASS [lynx24 solo 1] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [candlerider_gold solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [candleowl24 solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [mistrallynx solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [harmattan156 solo 1] live at the oracle price — status 2
- PASS [harmattan156 solo 1] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [candlerider_gold solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [mistrallynx solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] live at the oracle price — status 2
- PASS [candleowl24 solo 1] the reserve set aside 4 x stake and a borrow line — reserved 40 line 30
- PASS [candlerider_gold solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [candlerider_gold solo 1] live at the oracle price — status 2
- PASS [candlerider_gold solo 1] the reserve set aside 4 x stake and a borrow line — reserved 40 line 30
- PASS [mistrallynx solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [mistrallynx solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [nvidiasmith24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [mistrallynx solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [mistrallynx solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan156 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [candlerider_gold solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [mistrallynx solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [harmattan156 solo 1] state committed to Solana equals the rollup — 100057171/100057171
- PASS [harmattan156 solo 1] payout = position - borrow cost (pack: the gain only) — paid 100.007169 cost 0.050002 delta 0.007169
- PASS [harmattan156 solo 1] reservation released at settlement
- PASS [harmattan156 solo 1] profile records the climb — runs 7->8
- PASS [candlerider_gold solo 1] state committed to Solana equals the rollup — 9826466/9826466
- PASS [harmattan156 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo 1] state committed to Solana equals the rollup — 25014800/25014800
- PASS [candlerider_gold solo 1] payout = position - borrow cost (pack: the gain only) — paid 9.821466 cost 0.005 delta -0.178534
- PASS [candlerider_gold solo 1] reservation released at settlement
- PASS [candlerider_gold solo 1] profile records the climb — runs 10->11
- PASS [levechequeen solo 1] payout = position - borrow cost (pack: the gain only) — paid 25.0023 cost 0.0125 delta 0.0023
- PASS [levechequeen solo 1] reservation released at settlement
- PASS [levechequeen solo 1] profile records the climb — runs 10->11
- PASS [candlerider_gold solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo 1] state committed to Solana equals the rollup — 25512004/25512004
- PASS [lynx24 solo 1] payout = position - borrow cost (pack: the gain only) — paid 25.487003 cost 0.025001 delta 0.487003
- PASS [lynx24 solo 1] reservation released at settlement
- PASS [lynx24 solo 1] profile records the climb — runs 10->11
- PASS [lynx24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [nvidiasmith24 solo 1] state committed to Solana equals the rollup — 99547561/99547561
- PASS [candleowl24 solo 1] state committed to Solana equals the rollup — 9766517/9766517
- PASS [nvidiasmith24 solo 1] payout = position - borrow cost (pack: the gain only) — paid 99.447552 cost 0.100009 delta -0.552448
- PASS [nvidiasmith24 solo 1] reservation released at settlement
- PASS [nvidiasmith24 solo 1] profile records the climb — runs 7->8
- PASS [candleowl24 solo 1] payout = position - borrow cost (pack: the gain only) — paid 9.756517 cost 0.01 delta -0.243483
- PASS [candleowl24 solo 1] reservation released at settlement
- PASS [candleowl24 solo 1] profile records the climb — runs 10->11
- PASS [nvidiasmith24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candleowl24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo 1] state committed to Solana equals the rollup — 24623949/24623949
- PASS [harmattan_whale solo 1] payout = position - borrow cost (pack: the gain only) — paid 24.586445 cost 0.037504 delta -0.413555
- PASS [harmattan_whale solo 1] reservation released at settlement
- PASS [harmattan_whale solo 1] profile records the climb — runs 10->11
- PASS [harmattan_whale solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] expired by the crank at 60 s — status 5, 120 ticks
- PASS [mistrallynx solo 1] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [mistrallynx solo 1] state committed to Solana equals the rollup — 98914483/98914483
- PASS [mistrallynx solo 1] payout = position - borrow cost (pack: the gain only) — paid 98.614348 cost 0.300135 delta -1.385652
- PASS [mistrallynx solo 1] reservation released at settlement
- PASS [mistrallynx solo 1] profile records the climb — runs 10->11
- PASS [mistrallynx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [refusals] stake above 100 tUSDC — refused with 6009 — got 6009 big failed: {"InstructionError":[0,{"Custom":6009}]}
- PASS [refusals] a session key acting for another wallet — refused with 6000 — got 6000 impersonate failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a market that does not exist — refused with 6007 — got 6007 badasset failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [refusals] a pack climb without a pack — refused with 6023 — got 6023 nopack failed: {"InstructionError":[0,{"Custom":6023}]}
- PASS [refusals] faucet twice in a row — refused with 6006 — got 6006 faucet failed: {"InstructionError":[1,{"Custom":6006}]}
- PASS [packs] VRF packs drawn — Bronze,Silver,Bronze,Bronze,Silver,Bronze
- PASS [packs] a second pack while one waits — refused with 6011 — got 6011 open pack failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo pack] live at the oracle price — status 2
- PASS [mistrallynx solo pack] pack climb capped at its tier — top 1
- PASS [mistrallynx solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 15
- PASS [candleowl24 solo pack] live at the oracle price — status 2
- PASS [candleowl24 solo pack] pack climb capped at its tier — top 2
- PASS [candleowl24 solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 20
- PASS [harmattan_whale solo pack] live at the oracle price — status 2
- PASS [harmattan_whale solo pack] pack climb capped at its tier — top 2
- PASS [harmattan_whale solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 20
- PASS [levechequeen solo pack] live at the oracle price — status 2
- PASS [levechequeen solo pack] pack climb capped at its tier — top 1
- PASS [levechequeen solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 15
- PASS [lynx24 solo pack] live at the oracle price — status 2
- PASS [lynx24 solo pack] pack climb capped at its tier — top 1
- PASS [lynx24 solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 15
- PASS [candlerider_gold solo pack] live at the oracle price — status 2
- PASS [candlerider_gold solo pack] pack climb capped at its tier — top 1
- PASS [candlerider_gold solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 15
- PASS [mistrallynx solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx24 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo pack] state committed to Solana equals the rollup — 9815900/9815900
- PASS [candlerider_gold solo pack] payout = position - borrow cost (pack: the gain only) — paid 0 cost 0 delta 0
- PASS [candlerider_gold solo pack] reservation released at settlement
- PASS [candlerider_gold solo pack] profile records the climb — runs 11->12
- PASS [candlerider_gold solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo pack] state committed to Solana equals the rollup — 9866195/9866195
- PASS [lynx24 solo pack] payout = position - borrow cost (pack: the gain only) — paid 0 cost 0 delta 0
- PASS [lynx24 solo pack] reservation released at settlement
- PASS [lynx24 solo pack] profile records the climb — runs 11->12
- PASS [lynx24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo pack] state committed to Solana equals the rollup — 10001303/10001303
- PASS [levechequeen solo pack] payout = position - borrow cost (pack: the gain only) — paid 0.001303 cost 0 delta 0.001303
- PASS [levechequeen solo pack] reservation released at settlement
- PASS [levechequeen solo pack] profile records the climb — runs 11->12
- PASS [levechequeen solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo pack] state committed to Solana equals the rollup — 8844585/8844585
- PASS [mistrallynx solo pack] payout = position - borrow cost (pack: the gain only) — paid 0 cost 0 delta 0
- PASS [mistrallynx solo pack] reservation released at settlement
- PASS [mistrallynx solo pack] profile records the climb — runs 11->12
- PASS [mistrallynx solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candleowl24 solo pack] expired by the crank at 60 s — status 5, 120 ticks
- PASS [candleowl24 solo pack] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [harmattan_whale solo pack] expired by the crank at 60 s — status 5, 120 ticks
- PASS [harmattan_whale solo pack] crank ticked ~2/s for the whole climb — 120 ticks
- PASS [candleowl24 solo pack] state committed to Solana equals the rollup — 8614088/8614088
- PASS [harmattan_whale solo pack] state committed to Solana equals the rollup — 9913405/9913405
- PASS [candleowl24 solo pack] payout = position - borrow cost (pack: the gain only) — paid 0 cost 0 delta 0
- PASS [candleowl24 solo pack] reservation released at settlement
- PASS [candleowl24 solo pack] profile records the climb — runs 11->12
- PASS [harmattan_whale solo pack] payout = position - borrow cost (pack: the gain only) — paid 0 cost 0 delta 0
- PASS [harmattan_whale solo pack] reservation released at settlement
- PASS [harmattan_whale solo pack] profile records the climb — runs 11->12
- PASS [candleowl24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold lends] withdraw all shares at the share price — got 50.000021, due 50.000021
- PASS [candleowl24 lends] withdraw all shares at the share price — got 20.000008, due 20.000008
- PASS [mistrallynx lends] withdraw all shares at the share price — got 35.000015, due 35.000015
- PASS [reserve] nothing reserved, staked or lent once every climb settled — reserved 0 staked 0 lines 0 (others may be playing: start 0/0/0)
- PASS [reserve] borrow fees collected = the costs of the battery's climbs — 0.540151 tUSDC
- PASS [reserve] settled climbs counted — 14 runs
