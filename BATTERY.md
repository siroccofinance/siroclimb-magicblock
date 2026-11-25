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




## Run latest

Run 2026-11-25T19:30:22.235Z · program `BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ` · rollup https://devnet-eu.magicblock.app · 10 players · 2 solo waves · 184 s

**307 / 307 checks passed.** Admin SOL 3.1187 -> 2.4587 (funding players).

Sirocco Reserve: 26 climbs drew on it, 1.0301 tUSDC of borrow costs paid, net result for lenders -26.26 tUSDC; share price 0.999999.

Solo climbs settled: 20 (16 cashed, 4 expired), top leverage reached 4x.

Players (handles on chain): candlerider_gold, candleowl24, mistrallynx, levechequeen, harmattan_whale, lynx24, nvidiasmith24, harmattan156, yield.sol, simoom_smith.

## Latencies

| step | n | median ms | max ms |
|---|---|---|---|
| fund players (8 per tx) | 2 | 1287 | 1287 |
| onboard (profile, faucet, session, allowance) | 11 | 1144 | 1527 |
| deposit (Solana) | 3 | 1035 | 1037 |
| stake + delegate (Solana) | 26 | 1024 | 1308 |
| delegation visible on the rollup | 26 | 16 | 158 |
| begin + crank (rollup) | 26 | 341 | 488 |
| cash out + commit/undelegate (rollup) | 22 | 303 | 442 |
| undelegation back on Solana | 26 | 906 | 1058 |
| settle (Solana) | 26 | 1052 | 1640 |
| finish by a stranger (rollup) | 4 | 304 | 304 |
| open pack + VRF request (Solana) | 6 | 1039 | 1045 |
| pack VRF callback | 6 | 724 | 1131 |
| withdraw (Solana) | 3 | 1018 | 1229 |

## Checks

- PASS [candlerider_gold lends] deposit 50 tUSDC: shares at the share price — 49.999768 shares, expected 49.999768
- PASS [candleowl24 lends] deposit 20 tUSDC: shares at the share price — 19.999907 shares, expected 19.999907
- PASS [mistrallynx lends] deposit 35 tUSDC: shares at the share price — 34.999837 shares, expected 34.999837
- PASS [lenders] withdraw more shares than held — refused with 6029 — got 6029 withdraw failed: {"InstructionError":[1,{"Custom":6029}]}
- PASS [levechequeen solo 1] real position opened (short) — units 2616268 escrow 0
- PASS [harmattan156 solo 1] real position opened (long) — units 13068267 escrow 13068267
- PASS [candleowl24 solo 1] real position opened (short) — units 7039332 escrow 0
- PASS [levechequeen solo 1] live at the oracle price — status 2
- PASS [levechequeen solo 1] the reserve set aside 4 x stake and a borrow line — reserved 40 line 30
- PASS [harmattan156 solo 1] live at the oracle price — status 2
- PASS [harmattan156 solo 1] the reserve set aside 4 x stake and a borrow line — reserved 200 line 150
- PASS [candleowl24 solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [mistrallynx solo 1] real position opened (short) — units 7039332 escrow 0
- PASS [candlerider_gold solo 1] real position opened (long) — units 2812918 escrow 2812918
- PASS [yield.sol solo 1] real position opened (short) — units 28226 escrow 0
- PASS [simoom_smith solo 1] real position opened (long) — units 6534133 escrow 6534133
- PASS [harmattan_whale solo 1] real position opened (long) — units 14099 escrow 14099
- PASS [candlerider_gold solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [yield.sol solo 1] live at the oracle price — status 2
- PASS [yield.sol solo 1] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [mistrallynx solo 1] begin with another market's feed — refused with 6012 — got 6012 bad feed failed: {"InstructionError":[0,{"Custom":6012}]}
- PASS [lynx24 solo 1] real position opened (short) — units 2815732 escrow 0
- PASS [candleowl24 solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [nvidiasmith24 solo 1] real position opened (short) — units 28226 escrow 0
- PASS [harmattan_whale solo 1] live at the oracle price — status 2
- PASS [harmattan_whale solo 1] the reserve set aside 4 x stake and a borrow line — reserved 200 line 150
- PASS [simoom_smith solo 1] live at the oracle price — status 2
- PASS [simoom_smith solo 1] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [lynx24 solo 1] live at the oracle price — status 2
- PASS [lynx24 solo 1] the reserve set aside 4 x stake and a borrow line — reserved 40 line 30
- PASS [candlerider_gold solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [nvidiasmith24 solo 1] live at the oracle price — status 2
- PASS [nvidiasmith24 solo 1] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [mistrallynx solo 1] settle while the climb is on the rollup — refused with 3007 — got 3007 early settle failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candlerider_gold solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] live at the oracle price — status 2
- PASS [candleowl24 solo 1] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [candlerider_gold solo 1] live at the oracle price — status 2
- PASS [candlerider_gold solo 1] the reserve set aside 4 x stake and a borrow line — reserved 40 line 30
- PASS [mistrallynx solo 1] a second climb while one is delegated — refused with 3007 — got 3007 second failed: {"InstructionError":[0,{"Custom":3007}]}
- PASS [candleowl24 solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [candlerider_gold solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [mistrallynx solo 1] live at the oracle price — status 2
- PASS [mistrallynx solo 1] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [candleowl24 solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan156 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [mistrallynx solo 1] cash out signed by another player — refused with 6000 — got 6000 steal failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [mistrallynx solo 1] finish before the bell — refused with 6011 — got 6011 early finish failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [yield.sol solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [simoom_smith solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [nvidiasmith24 solo 1] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [candlerider_gold solo 1] crank ticks on the rollup — 8 ticks in 3 s
- PASS [mistrallynx solo 1] crank ticks on the rollup — 9 ticks in 3 s
- PASS [harmattan_whale solo 1] state committed to Solana equals the rollup — 49490582/49490582
- PASS [yield.sol solo 1] state committed to Solana equals the rollup — 101012390/101012390
- PASS [harmattan_whale solo 1] payout = position - borrow cost (pack: the gain only) — paid 49.465582 cost 0.025 delta -0.534418
- PASS [harmattan_whale solo 1] reservation released at settlement
- PASS [harmattan_whale solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.080525 boost -0.428893
- PASS [harmattan_whale solo 1] profile records the climb — runs 12->13
- PASS [harmattan_whale solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [simoom_smith solo 1] state committed to Solana equals the rollup — 25437159/25437159
- PASS [yield.sol solo 1] payout = position - borrow cost (pack: the gain only) — paid 100.96239 cost 0.05 delta 0.96239
- PASS [yield.sol solo 1] reservation released at settlement
- PASS [yield.sol solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.141376 boost 1.153766
- PASS [yield.sol solo 1] profile records the climb — runs 4->5
- PASS [simoom_smith solo 1] payout = position - borrow cost (pack: the gain only) — paid 25.424659 cost 0.0125 delta 0.424659
- PASS [simoom_smith solo 1] reservation released at settlement
- PASS [simoom_smith solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.032586 boost 0.469745
- PASS [simoom_smith solo 1] profile records the climb — runs 4->5
- PASS [yield.sol solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [simoom_smith solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan156 solo 1] state committed to Solana equals the rollup — 51861328/51861328
- PASS [harmattan156 solo 1] payout = position - borrow cost (pack: the gain only) — paid 51.811327 cost 0.050001 delta 1.811327
- PASS [harmattan156 solo 1] reservation released at settlement
- PASS [harmattan156 solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.079382 boost 1.94071
- PASS [harmattan156 solo 1] profile records the climb — runs 8->9
- PASS [harmattan156 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo 1] state committed to Solana equals the rollup — 9784625/9784625
- PASS [levechequeen solo 1] payout = position - borrow cost (pack: the gain only) — paid 9.769624 cost 0.015001 delta -0.230376
- PASS [levechequeen solo 1] reservation released at settlement
- PASS [levechequeen solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.027362 boost -0.188013
- PASS [levechequeen solo 1] profile records the climb — runs 12->13
- PASS [levechequeen solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [nvidiasmith24 solo 1] state committed to Solana equals the rollup — 111502126/111502126
- PASS [mistrallynx solo 1] state committed to Solana equals the rollup — 27132880/27132880
- PASS [nvidiasmith24 solo 1] payout = position - borrow cost (pack: the gain only) — paid 111.352109 cost 0.150017 delta 11.352109
- PASS [nvidiasmith24 solo 1] reservation released at settlement
- PASS [nvidiasmith24 solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.182799 boost 11.684925
- PASS [nvidiasmith24 solo 1] profile records the climb — runs 8->9
- PASS [mistrallynx solo 1] payout = position - borrow cost (pack: the gain only) — paid 27.095376 cost 0.037504 delta 2.095376
- PASS [mistrallynx solo 1] reservation released at settlement
- PASS [mistrallynx solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.042805 boost 2.175685
- PASS [mistrallynx solo 1] profile records the climb — runs 12->13
- PASS [nvidiasmith24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo 1] expired by the crank at 60 s — status 5, 121 ticks
- PASS [lynx24 solo 1] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [candlerider_gold solo 1] expired by the crank at 60 s — status 5, 121 ticks
- PASS [candlerider_gold solo 1] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [candleowl24 solo 1] expired by the crank at 60 s — status 5, 121 ticks
- PASS [candleowl24 solo 1] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [lynx24 solo 1] state committed to Solana equals the rollup — 8139786/8139786
- PASS [candlerider_gold solo 1] state committed to Solana equals the rollup — 11836243/11836243
- PASS [lynx24 solo 1] payout = position - borrow cost (pack: the gain only) — paid 8.109773 cost 0.030013 delta -1.890227
- PASS [lynx24 solo 1] reservation released at settlement
- PASS [lynx24 solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.061488 boost -1.798726
- PASS [lynx24 solo 1] profile records the climb — runs 12->13
- PASS [candleowl24 solo 1] state committed to Solana equals the rollup — 20610479/20610479
- PASS [lynx24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold solo 1] payout = position - borrow cost (pack: the gain only) — paid 11.80623 cost 0.030013 delta 1.80623
- PASS [candlerider_gold solo 1] reservation released at settlement
- PASS [candlerider_gold solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.018761 boost 1.855004
- PASS [candlerider_gold solo 1] profile records the climb — runs 12->13
- PASS [candleowl24 solo 1] payout = position - borrow cost (pack: the gain only) — paid 20.535446 cost 0.075033 delta -4.464554
- PASS [candleowl24 solo 1] reservation released at settlement
- PASS [candleowl24 solo 1] position closed: escrow empty, real P&L + game boost = the result — real -0.153219 boost -4.236302
- PASS [candleowl24 solo 1] profile records the climb — runs 12->13
- PASS [candlerider_gold solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candleowl24 solo 1] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo 2] real position opened (short) — units 16868428 escrow 0
- PASS [simoom_smith solo 2] real position opened (long) — units 2811652 escrow 2811652
- PASS [nvidiasmith24 solo 2] real position opened (long) — units 7049 escrow 7049
- PASS [lynx24 solo 2] live at the oracle price — status 2
- PASS [lynx24 solo 2] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [simoom_smith solo 2] live at the oracle price — status 2
- PASS [simoom_smith solo 2] the reserve set aside 4 x stake and a borrow line — reserved 40 line 30
- PASS [nvidiasmith24 solo 2] live at the oracle price — status 2
- PASS [nvidiasmith24 solo 2] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [yield.sol solo 2] real position opened (long) — units 67406275 escrow 67406275
- PASS [mistrallynx solo 2] real position opened (long) — units 28196 escrow 28196
- PASS [harmattan156 solo 2] real position opened (long) — units 28196 escrow 28196
- PASS [harmattan_whale solo 2] real position opened (short) — units 16868428 escrow 0
- PASS [levechequeen solo 2] real position opened (long) — units 26090822 escrow 26090822
- PASS [yield.sol solo 2] live at the oracle price — status 2
- PASS [yield.sol solo 2] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [mistrallynx solo 2] live at the oracle price — status 2
- PASS [mistrallynx solo 2] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [candlerider_gold solo 2] real position opened (long) — units 6522705 escrow 6522705
- PASS [harmattan_whale solo 2] live at the oracle price — status 2
- PASS [harmattan_whale solo 2] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [levechequeen solo 2] live at the oracle price — status 2
- PASS [levechequeen solo 2] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [harmattan156 solo 2] live at the oracle price — status 2
- PASS [harmattan156 solo 2] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [candleowl24 solo 2] real position opened (short) — units 28144655 escrow 0
- PASS [candlerider_gold solo 2] live at the oracle price — status 2
- PASS [candlerider_gold solo 2] the reserve set aside 4 x stake and a borrow line — reserved 100 line 75
- PASS [candleowl24 solo 2] live at the oracle price — status 2
- PASS [candleowl24 solo 2] the reserve set aside 4 x stake and a borrow line — reserved 400 line 300
- PASS [lynx24 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [simoom_smith solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [nvidiasmith24 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [yield.sol solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [mistrallynx solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan156 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo 2] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo 2] state committed to Solana equals the rollup — 101670540/101670540
- PASS [mistrallynx solo 2] state committed to Solana equals the rollup — 104428012/104428012
- PASS [levechequeen solo 2] payout = position - borrow cost (pack: the gain only) — paid 101.620539 cost 0.050001 delta 1.620539
- PASS [levechequeen solo 2] reservation released at settlement
- PASS [levechequeen solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.173391 boost 1.843931
- PASS [levechequeen solo 2] profile records the climb — runs 13->14
- PASS [nvidiasmith24 solo 2] state committed to Solana equals the rollup — 26504637/26504637
- PASS [yield.sol solo 2] state committed to Solana equals the rollup — 101640321/101640321
- PASS [harmattan156 solo 2] state committed to Solana equals the rollup — 102884023/102884023
- PASS [mistrallynx solo 2] payout = position - borrow cost (pack: the gain only) — paid 104.37801 cost 0.050002 delta 4.37801
- PASS [mistrallynx solo 2] reservation released at settlement
- PASS [levechequeen solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.124411 boost 4.552423
- PASS [mistrallynx solo 2] profile records the climb — runs 13->14
- PASS [nvidiasmith24 solo 2] payout = position - borrow cost (pack: the gain only) — paid 26.492137 cost 0.0125 delta 1.492137
- PASS [nvidiasmith24 solo 2] reservation released at settlement
- PASS [nvidiasmith24 solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.031646 boost 1.536283
- PASS [yield.sol solo 2] payout = position - borrow cost (pack: the gain only) — paid 101.590319 cost 0.050002 delta 1.590319
- PASS [yield.sol solo 2] reservation released at settlement
- PASS [nvidiasmith24 solo 2] profile records the climb — runs 9->10
- PASS [yield.sol solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.070768 boost 1.711089
- PASS [yield.sol solo 2] profile records the climb — runs 5->6
- PASS [harmattan156 solo 2] payout = position - borrow cost (pack: the gain only) — paid 102.78402 cost 0.100003 delta 2.78402
- PASS [harmattan156 solo 2] reservation released at settlement
- PASS [harmattan156 solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.166415 boost 3.050438
- PASS [harmattan156 solo 2] profile records the climb — runs 9->10
- PASS [yield.sol solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [nvidiasmith24 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan156 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo 2] state committed to Solana equals the rollup — 23612031/23612031
- PASS [lynx24 solo 2] payout = position - borrow cost (pack: the gain only) — paid 23.574529 cost 0.037502 delta -1.425471
- PASS [lynx24 solo 2] reservation released at settlement
- PASS [lynx24 solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.124539 boost -1.26343
- PASS [lynx24 solo 2] profile records the climb — runs 13->14
- PASS [candlerider_gold solo 2] state committed to Solana equals the rollup — 27359916/27359916
- PASS [lynx24 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold solo 2] payout = position - borrow cost (pack: the gain only) — paid 27.322414 cost 0.037502 delta 2.322414
- PASS [candlerider_gold solo 2] reservation released at settlement
- PASS [candlerider_gold solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.052532 boost 2.412448
- PASS [candlerider_gold solo 2] profile records the climb — runs 13->14
- PASS [harmattan_whale solo 2] state committed to Solana equals the rollup — 23728849/23728849
- PASS [candlerider_gold solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo 2] payout = position - borrow cost (pack: the gain only) — paid 23.691346 cost 0.037503 delta -1.308654
- PASS [harmattan_whale solo 2] reservation released at settlement
- PASS [harmattan_whale solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.116947 boost -1.154204
- PASS [harmattan_whale solo 2] profile records the climb — runs 13->14
- PASS [candleowl24 solo 2] state committed to Solana equals the rollup — 103597606/103597606
- PASS [harmattan_whale solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candleowl24 solo 2] payout = position - borrow cost (pack: the gain only) — paid 103.447589 cost 0.150017 delta 3.447589
- PASS [candleowl24 solo 2] reservation released at settlement
- PASS [candleowl24 solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.207894 boost 3.8055
- PASS [candleowl24 solo 2] profile records the climb — runs 13->14
- PASS [candleowl24 solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [simoom_smith solo 2] expired by the crank at 60 s — status 5, 121 ticks
- PASS [simoom_smith solo 2] crank ticked ~2/s for the whole climb — 121 ticks
- PASS [simoom_smith solo 2] state committed to Solana equals the rollup — 8902632/8902632
- PASS [simoom_smith solo 2] payout = position - borrow cost (pack: the gain only) — paid 8.872619 cost 0.030013 delta -1.127381
- PASS [simoom_smith solo 2] reservation released at settlement
- PASS [simoom_smith solo 2] position closed: escrow empty, real P&L + game boost = the result — real -0.052142 boost -1.045226
- PASS [simoom_smith solo 2] profile records the climb — runs 5->6
- PASS [simoom_smith solo 2] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [refusals] stake above 100 tUSDC — refused with 6009 — got 6009 big failed: {"InstructionError":[0,{"Custom":6009}]}
- PASS [refusals] a session key acting for another wallet — refused with 6000 — got 6000 impersonate failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] a market that does not exist — refused with 6007 — got 6007 badasset failed: {"InstructionError":[0,{"Custom":6007}]}
- PASS [refusals] a pack climb without a pack — refused with 6023 — got 6023 nopack failed: {"InstructionError":[0,{"Custom":6023}]}
- PASS [refusals] a price pushed by a player — refused with 6000 — got 6000 push failed: {"InstructionError":[0,{"Custom":6000}]}
- PASS [refusals] faucet twice in a row — refused with 6006 — got 6006 faucet failed: {"InstructionError":[1,{"Custom":6006}]}
- PASS [packs] VRF packs drawn — Silver,Diamond,Gold,Diamond,Bronze,Silver
- PASS [packs] a second pack while one waits — refused with 6011 — got 6011 open pack failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold solo pack] real position opened (long) — units 37276531 escrow 37276531
- PASS [lynx24 solo pack] real position opened (short) — units 2615721 escrow 0
- PASS [candleowl24 solo pack] real position opened (short) — units 6748281 escrow 0
- PASS [candlerider_gold solo pack] live at the oracle price — status 2
- PASS [candlerider_gold solo pack] pack climb capped at its tier — top 2
- PASS [candlerider_gold solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 20
- PASS [levechequeen solo pack] real position opened (short) — units 2615721 escrow 0
- PASS [lynx24 solo pack] live at the oracle price — status 2
- PASS [lynx24 solo pack] pack climb capped at its tier — top 2
- PASS [lynx24 solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 20
- PASS [candleowl24 solo pack] live at the oracle price — status 2
- PASS [candleowl24 solo pack] pack climb capped at its tier — top 6
- PASS [candleowl24 solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 40
- PASS [levechequeen solo pack] live at the oracle price — status 2
- PASS [levechequeen solo pack] pack climb capped at its tier — top 6
- PASS [levechequeen solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 40
- PASS [harmattan_whale solo pack] real position opened (long) — units 2613106 escrow 2613106
- PASS [mistrallynx solo pack] real position opened (long) — units 2613106 escrow 2613106
- PASS [harmattan_whale solo pack] live at the oracle price — status 2
- PASS [harmattan_whale solo pack] pack climb capped at its tier — top 1
- PASS [harmattan_whale solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 15
- PASS [mistrallynx solo pack] live at the oracle price — status 2
- PASS [mistrallynx solo pack] pack climb capped at its tier — top 4
- PASS [mistrallynx solo pack] the reserve set aside 4 x stake and a borrow line — reserved 40 line 30
- PASS [candlerider_gold solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [lynx24 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candleowl24 solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [levechequeen solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [harmattan_whale solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [mistrallynx solo pack] crank ticks on the rollup — 7 ticks in 3 s
- PASS [candlerider_gold solo pack] state committed to Solana equals the rollup — 9687224/9687224
- PASS [candlerider_gold solo pack] payout = position - borrow cost (pack: the gain only) — paid 0 cost 0 delta 0
- PASS [candlerider_gold solo pack] reservation released at settlement
- PASS [candlerider_gold solo pack] position closed: escrow empty, real P&L + game boost = the result — real -0.009155 boost -0.303621
- PASS [candlerider_gold solo pack] profile records the climb — runs 14->15
- PASS [candlerider_gold solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [harmattan_whale solo pack] state committed to Solana equals the rollup — 9795624/9795624
- PASS [harmattan_whale solo pack] payout = position - borrow cost (pack: the gain only) — paid 0 cost 0 delta 0
- PASS [harmattan_whale solo pack] reservation released at settlement
- PASS [harmattan_whale solo pack] position closed: escrow empty, real P&L + game boost = the result — real -0.023095 boost -0.181281
- PASS [harmattan_whale solo pack] profile records the climb — runs 14->15
- PASS [harmattan_whale solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candleowl24 solo pack] state committed to Solana equals the rollup — 10267774/10267774
- PASS [candleowl24 solo pack] payout = position - borrow cost (pack: the gain only) — paid 0.267774 cost 0 delta 0.267774
- PASS [candleowl24 solo pack] reservation released at settlement
- PASS [candleowl24 solo pack] position closed: escrow empty, real P&L + game boost = the result — real -0.008022 boost 0.275796
- PASS [candleowl24 solo pack] profile records the climb — runs 14->15
- PASS [levechequeen solo pack] state committed to Solana equals the rollup — 9614241/9614241
- PASS [candleowl24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [levechequeen solo pack] payout = position - borrow cost (pack: the gain only) — paid 0 cost 0 delta 0
- PASS [levechequeen solo pack] reservation released at settlement
- PASS [levechequeen solo pack] position closed: escrow empty, real P&L + game boost = the result — real -0.018959 boost -0.3668
- PASS [levechequeen solo pack] profile records the climb — runs 14->15
- PASS [lynx24 solo pack] state committed to Solana equals the rollup — 9750012/9750012
- PASS [levechequeen solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [lynx24 solo pack] payout = position - borrow cost (pack: the gain only) — paid 0 cost 0 delta 0
- PASS [lynx24 solo pack] reservation released at settlement
- PASS [lynx24 solo pack] position closed: escrow empty, real P&L + game boost = the result — real -0.017388 boost -0.2326
- PASS [lynx24 solo pack] profile records the climb — runs 14->15
- PASS [lynx24 solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [mistrallynx solo pack] state committed to Solana equals the rollup — 10885745/10885745
- PASS [mistrallynx solo pack] payout = position - borrow cost (pack: the gain only) — paid 0.885745 cost 0 delta 0.885745
- PASS [mistrallynx solo pack] reservation released at settlement
- PASS [mistrallynx solo pack] position closed: escrow empty, real P&L + game boost = the result — real -0.020426 boost 0.906171
- PASS [mistrallynx solo pack] profile records the climb — runs 14->15
- PASS [mistrallynx solo pack] settle twice — refused with 6011 — got 6011 twice failed: {"InstructionError":[0,{"Custom":6011}]}
- PASS [candlerider_gold lends] withdraw all shares at the share price — got 49.999716, due 49.999716
- PASS [candleowl24 lends] withdraw all shares at the share price — got 19.999886, due 19.999886
- PASS [mistrallynx lends] withdraw all shares at the share price — got 34.9998, due 34.9998
- PASS [reserve] nothing reserved, staked or lent once every climb settled — reserved 500000000 staked 125000000 lines 375000000 (others may be playing: start 500000000/125000000/375000000)
- PASS [reserve] borrow fees collected = the costs of the battery's climbs — 1.030127 tUSDC
- PASS [reserve] settled climbs counted — 26 runs
