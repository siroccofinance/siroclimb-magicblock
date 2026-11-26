# Siroclimb: Solana Blitz v10 submission (draft)

Draft for the Blitz v10 form at https://build.magicblock.app/?stage=blitz#submit (Entertainment Finance). Nothing here is submitted or posted.

Before submitting:
- The form asks for an accessible GitHub repo; `siroccofinance/siroclimb-magicblock` is private today.
- Record the video (script below) and fill in the team's wallet, X account and team members.
- The form lists program and wallet addresses as optional, but says they strengthen a submission and that devnet activity is checked.

## Form fields

| Field | Value |
|---|---|
| Project name | Siroclimb |
| Categories | Games, DeFi, Consumer |
| Project website | https://siroclimb.sirocco.finance |
| GitHub repo | https://github.com/siroccofinance/siroclimb-magicblock |
| Pitch & demo | video link (to record, script below) |
| Explorer link (integration proof) | any climb's result screen lists its four transactions; program: https://explorer.solana.com/address/BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ?cluster=devnet |
| On-chain: program | `BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ` (devnet): run delegations, VRF requests |
| On-chain: wallet | relay key `DzeEB8bDswhwwWiwGDkvQywnX3V97B7FPJUQfnwRUAvK` (pushes xStock prices on the rollup) |
| Wallet for prizes, X account, team | to fill in by the team |

## Description (short)

Siroclimb is a one-minute leverage climb on tokenized stocks (TSLAx, NVDAx, AAPLx, MSTRx) and tokenized gold (XAUt). Go long or short: the coin rolls up and down a staircase that follows the live price, leverage steps from 1x to 4x every 6 seconds, and you cash out whenever you like. Your stake is the most you can lose. Every climb is a real position: long, it buys the market's token (real tokens sit in the climb's escrow); short, it borrows and sells it, through the program's own swap venue (the Sirocco desk). Leverage is a real loan from the Sirocco Reserve, a tUSDC lending pool anyone can lend to and earn from. The game magnifies the moves ("moves ×90"), and the result splits the tokens' P&L from the game's boost. Every climb runs fully on chain on a MagicBlock Ephemeral Rollup: 120 ticks a minute, zero fees, one wallet approval, settled on Solana. Every market trades 24/7, and so does the game.

## How MagicBlock is used

- **Ephemeral Rollups.** Each climb's `Run` account is delegated in the same Solana transaction as the stake (`start_run` + `delegate_run`). The minute of play runs on the rollup: entry at the live price, a tick every 500 ms, leverage steps, the bust, the cash out. `cash_out` commits and undelegates in the same instruction, and `settle_run` pays out on Solana. Money (stakes, vault, the Reserve) never leaves Solana.
- **Cranks (`ScheduleTask`).** `begin_run` schedules `tick_run` every 500 ms on the rollup, about 120 ticks per climb, with no off-chain loop. Ticks are permissionless and idempotent.
- **Real-time prices on the rollup, 24/7.** Every market reads a program-owned relay account on the rollup, pushed gasless every second from the token's own 24/7 market: the xStocks, and XAUt (Tether Gold) for gold. Pyth's US equity feeds stand still outside US hours and Pyth's spot gold closes on weekends, so no market closes this way. The program checks addresses, owners and staleness.
- **VRF.** Free leverage packs: MagicBlock's VRF draws the tier (1.5x to 4x), and the callback is only accepted from the VRF program's identity.
- **Real positions across both layers.** The opening fill moves real tokens on Solana in the same transaction as the stake and the delegation. Each leverage step is filled on the rollup at that tick's price, and the booked tokens move on Solana at settlement, together with the close.
- **Session keys.** One wallet approval creates a `SessionTokenV2` and a tUSDC spending allowance. After that, every stake, cash out and pack is signed by the session key, with no prompt.
- **Measured** (devnet-eu battery medians): delegation visible on the rollup in 17 ms, begin in 0.31 s, cash out with commit and undelegate in 0.30 s, back on Solana in 0.9 s.

## Links

- Play: https://siroclimb.sirocco.finance (built-in burner wallet, devnet, nothing to install)
- Repo: https://github.com/siroccofinance/siroclimb-magicblock
- Program: https://explorer.solana.com/address/BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ?cluster=devnet
- Architecture, Reserve mechanics, 24/7 pricing, tests: [README.md](README.md); every account: [DEPLOYMENTS.md](DEPLOYMENTS.md); bugs found and fixed: [FINDINGS.md](FINDINGS.md)

## Demo video script (about 2 min 30)

**0:00 to 0:15, hook.** On screen: the landing scene with the coin rolling on the stairs.
> "Siroclimb: a one-minute leverage climb on tokenized stocks, fully on chain on a MagicBlock Ephemeral Rollup."

**0:15 to 0:35, onboarding.** Click **Start playing**, then **Connect**, then **Burner**.
> "One approval: a profile, test USDC, and a MagicBlock session key. From here on, no more wallet prompts."

**0:35 to 1:20, a climb.** Pick **TSLAx**, **Long**, **25**, then **Start climbing**. Point at the leverage gauge (1x, 1.5x, 2x), the price chart, and the "Borrowed from the Sirocco Reserve" line.
> "The stake just bought real TSLAx tokens into this climb's escrow, and my run account was delegated to the rollup. A crank ticks the climb every half second: price, leverage, value, the bust. That's 120 on-chain ticks a minute, at zero fees. Tesla's xStock trades 24/7, so its live price is relayed into the rollup, even at night."
> "Past 1x the position is borrowed from the Sirocco Reserve, a lending pool anyone can lend to."

**1:20 to 1:40, cash out.** Click **Cash out**. The coin is tossed and the result shows.
> "Cash out commits the climb back to Solana in the same instruction. It's settled and paid in about a second."
Click a **Verify** link.
> "Every step is on the explorer: two transactions on Solana, two on the rollup."

**1:40 to 2:00, share.** Click **Share on X**. The post shows the result card.
> "The card is read from the settled climb on chain and signed, so nobody can fake a result."

**2:00 to 2:20, Reserve and packs.** Open the bank icon: TVL, utilization, lender APY. Then the pack button: a VRF draw.
> "Lenders earn the borrow fees and the losing stakes. Free packs are drawn by MagicBlock's VRF."

**2:20 to 2:30, close.**
> "Siroclimb: entertainment finance on a MagicBlock Ephemeral Rollup. Real prices, real leverage, real settlement."

## Tweet draft

> Siroclimb 🪙 a one-minute leverage climb on tokenized stocks.
>
> Long or short TSLAx, NVDAx, AAPLx, MSTRx or gold, 24/7, 1x to 4x, cash out anytime. Real tokens bought or borrowed, with leverage from a lending pool.
>
> Fully on-chain on a @magicblock Ephemeral Rollup: 120 ticks a minute, zero fees, settled on Solana. Built for Solana Blitz v10.
>
> https://siroclimb.sirocco.finance
