# Demo script (pitch video, about 3 minutes)

Before recording: `npm run dev` (or the hosted site), a fresh browser profile, an
open market (stocks: Sun 20:00 to Fri 20:00 New York, closed on Thanksgiving
until 20:00 and from 17:00 on the 27th; gold Sun 18:00 to Fri 17:00 with a
daily hour off at 17:00; GBP/USD every day via the relay). The lobby shows a
closed market as "Closed" with when it opens. Optionally `npm run keeper` so a
round is always open. Sound on.

## 1. Hook (0:00 to 0:20)

Landing film, then **Start playing**.

> "Siroclimb is a one-minute leverage climb on real-world assets: Tesla, NVIDIA
> and Apple xStocks, gold and the pound. Every step adds leverage, up to 4x.
> Cash out whenever you want; your stake is the most you can lose."

## 2. One approval, then instant (0:20 to 0:50)

Pick **TSLAx**, **Long**, **25**. Click **Start climbing**, choose **Burner wallet**
(or Phantom on devnet: one approval).

> "One signature sets everything up on Solana: an on-chain profile, a thousand
> Sirocco test dollars, and a MagicBlock session key allowed to stake for me.
> From now on there are no more pop ups."

## 3. The climb on the rollup (0:50 to 1:40)

The belt brakes, the coin starts climbing. Point at the leverage gauge (1x, 1.5x, 2x…),
the price and the sparkline.

> "This climb is not in my browser. My run account was delegated to a MagicBlock
> Ephemeral Rollup: the entry is MagicBlock's real-time Pyth price for Tesla, and a
> crank ticks the climb on chain every half second: leverage steps, value, the bust.
> All of that is free and instant."

Cash out with **Space** around 2x to 3x.

> "Cashing out is one rollup transaction signed by the session key. The same
> transaction commits the result and hands the account back to Solana, where the
> house vault pays me."

## 4. Proof (1:40 to 2:00)

On the result screen, click the **Verify** links: stake + delegate (Solana), begin
(rollup, crank scheduled), cash out (rollup, commit + undelegate), settle (Solana).

> "Every step is on the explorer: two transactions on Solana, two on the rollup."

## 5. A round (2:00 to 2:40)

**Play again**, switch to **Round**. The market is drawn by MagicBlock VRF. **Join for 10 tUSDC**.

> "Rounds put everyone on the same market for the same minute. The market was
> picked by verifiable randomness. If nobody else is around, practice players join
> from my own browser, with their own keypairs, and play their seat on chain."

Play, cash out, show the standings and the podium payout (50 / 30 / 20).

> "No server runs this round: opening, delegating, the bell, finishing and paying
> are all permissionless, and whichever browser is open pushes them along."

## 6. Packs and close (2:40 to 3:00)

Open **Leverage pack**: the VRF draws Bronze to Diamond; play the free climb.

> "Leverage packs are free climbs on the house, drawn by MagicBlock VRF. Siroclimb:
> real-world assets, real-time on MagicBlock, settled on Solana."

Show the leaderboard (today, all time, last round), read from on-chain profiles.
