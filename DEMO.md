# Demo script (pitch video, about 3 minutes)

Before recording: `npm run dev` (or the hosted site), a fresh browser profile, an
open market (the xStocks are open 24/7; gold Sun 18:00 to Fri 17:00 New York
with a daily hour off at 17:00). The lobby shows a closed market as "Closed"
with when it opens. Sound on.

## 1. Hook (0:00 to 0:20)

Landing film, then **Start playing**.

> "Siroclimb is a one-minute leverage climb on real-world assets: Tesla, NVIDIA,
> Apple and GameStop xStocks, and gold. Every step adds leverage, up to 4x.
> Cash out whenever you want; your stake is the most you can lose."

## 2. One approval, then instant (0:20 to 0:50)

Pick **TSLAx**, **Long**, **25**. Click **Start climbing**, choose **Burner wallet**
(or Phantom on devnet: one approval).

> "One signature sets everything up on Solana: an on-chain profile, a thousand
> Sirocco test dollars, and a MagicBlock session key allowed to stake for me.
> From now on there are no more pop ups."

Open the wallet menu for a second: handle, game session valid until…, fuel for
about N climbs.

## 3. The climb on the rollup (0:50 to 1:40)

The belt brakes, the coin starts climbing. Point at the leverage gauge (1x, 1.5x, 2x…),
the price and the sparkline (already full: it is read back from the rollup's own
price updates).

> "xStocks trade around the clock, and so does the game: their live 24/7 price
> is relayed into the rollup, nights and weekends. This climb is not in my browser. My run account was delegated to a MagicBlock
> Ephemeral Rollup: the entry is Tesla's live xStock price on the rollup, and a
> crank ticks the climb on chain every half second: leverage steps, value, the bust.
> All of that is free and instant."

Point at the line under the stake bar: "Borrowed 25.00 tUSDC from the Sirocco Reserve".

> "The leverage is a real loan. At 2x, half of my position is tUSDC borrowed from
> the Sirocco Reserve, a pool anyone can lend to. I pay a small fee and interest for
> the seconds I hold it, and I can never lose more than my stake."

Cash out with **Space** around 2x to 3x.

> "Cashing out is one rollup transaction signed by the session key. The same
> transaction commits the result and hands the account back to Solana, where the
> reserve pays me the position minus the borrow cost."

The result shows **Borrowed up to** and **Borrow cost paid**.

## 4. Proof (1:40 to 2:00)

On the result screen, click the **Verify** links: stake + delegate (Solana), begin
(rollup, crank scheduled), cash out (rollup, commit + undelegate), settle (Solana).

> "Every step is on the explorer: two transactions on Solana, two on the rollup."

## 5. Another market, short (2:00 to 2:40)

**Play again**, pick **GMEx**, **Short**, **50**. Ride it a little longer.

> "Five markets, all priced on the rollup: the four xStocks from their own 24/7
> market through the program's relay, gold from MagicBlock's Pyth feed, with its
> trading sessions enforced by the program itself. Every
> step of a climb is permissionless: if I close the tab, any browser finishes and
> settles it."

## 6. The reserve, packs and close (2:40 to 3:10)

Open the **Sirocco Reserve** (bank icon): TVL, utilization, share price, lender APY.
Deposit 100 tUSDC.

> "Lenders earn every borrow fee and take the other side of every climb. A climb
> only starts if the reserve can cover what it might owe, and that liquidity is
> locked on chain until the climb settles."

Open **Leverage pack**: the VRF draws Bronze to Diamond; play the free climb.

> "Leverage packs are free climbs on the reserve's money, drawn by MagicBlock VRF.
> Siroclimb: real-world assets, real-time on MagicBlock, real leverage, settled on Solana."

Show the leaderboard (today, all time), read from on-chain profiles.
