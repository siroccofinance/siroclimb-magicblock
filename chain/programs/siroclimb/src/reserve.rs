//! The Sirocco Reserve: a tUSDC lending pool that backs every solo climb.
//!
//! Lenders deposit tUSDC into the house vault and receive shares; a share is
//! worth `assets / shares`, where `assets` is the vault minus the stakes of the
//! climbs in flight (the players' own money). Everything a climb costs or earns
//! lands on the lenders: borrow interest and fees, the stakes of losing climbs,
//! the gains paid to winning ones.
//!
//! A climb is a margin loan without liquidation. The player puts up the stake
//! S; at leverage L the position is S x L, of which S x (L - 1) is borrowed from
//! the reserve. The position value moves with the price (the game's boost and
//! ladder, `game.rs`), is floored at zero (the player never loses more than the
//! stake: the reserve absorbs any shortfall past it) and capped at
//! `MAX_PAYOUT_MULT` x S. At settlement the borrow cost (a fee on the peak
//! borrow plus per-second interest on what was borrowed, `borrow_cost`) is
//! taken from the position and stays with the reserve.
//!
//! A climb can only start if the reserve's free liquidity (`assets - reserved`)
//! covers what it could owe the player beyond the stake, `(MAX_PAYOUT_MULT - 1)
//! x S`, which is more than its largest borrow, 3 x S. That amount is reserved
//! until the climb settles, and lenders cannot withdraw it meanwhile.
use anchor_lang::prelude::*;

use crate::game::{step_at, LADDER, RUN_SECONDS};

/// A climb's value is capped at this multiple of its stake: the most the
/// reserve can owe a player is `(MAX_PAYOUT_MULT - 1) x stake` on top of it.
pub const MAX_PAYOUT_MULT: u64 = 5;
/// Borrow interest, stated as an APR in basis points: 36.5 % a year, 0.1 % a day.
pub const BORROW_APR_BPS: u64 = 3_650;
/// Opening fee on the peak borrow of a climb, in basis points: 0.1 %.
pub const BORROW_FEE_BPS: u64 = 10;
pub const SECONDS_PER_YEAR: u64 = 31_536_000;
pub const BPS: u64 = 10_000;

#[account]
#[derive(InitSpace)]
pub struct Reserve {
    /// Lender shares outstanding (6 decimals, like tUSDC).
    pub shares: u64,
    /// Stakes of the climbs in flight: in the vault, but the players' money.
    pub staked: u64,
    /// Liquidity set aside for the climbs in flight (their most the reserve can owe).
    pub reserved: u64,
    /// Borrow lines of the climbs in flight: the most each can borrow (3 x stake).
    pub lines: u64,
    /// Climbs settled against the reserve, and money that went through it.
    pub runs: u64,
    pub borrowed_volume: u64,
    pub fees: u64,
    pub paid_to_players: u64,
    pub kept_from_players: u64,
    pub deposits: u64,
    pub withdrawals: u64,
    pub created_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Lender {
    pub owner: Pubkey,
    pub shares: u64,
    /// Total deposited and withdrawn (tUSDC), for the position's history.
    pub deposited: u64,
    pub withdrawn: u64,
    pub bump: u8,
}

/// The lenders' assets: the vault minus the stakes of the climbs in flight.
pub fn assets_of(vault: u64, staked: u64) -> u64 {
    vault.saturating_sub(staked)
}

/// Shares for a deposit of `amount` (rounded down: the pool never loses).
pub fn shares_for(amount: u64, assets: u64, shares: u64) -> u64 {
    if shares == 0 || assets == 0 {
        amount
    } else {
        (amount as u128 * shares as u128 / assets as u128) as u64
    }
}

/// tUSDC for `n` shares (rounded down).
pub fn value_of(n: u64, assets: u64, shares: u64) -> u64 {
    if shares == 0 {
        0
    } else {
        (n as u128 * assets as u128 / shares as u128) as u64
    }
}

/// What a climb may owe beyond its stake, reserved while it runs.
pub fn exposure_of(stake: u64) -> u64 {
    stake * (MAX_PAYOUT_MULT - 1)
}

/// The most a climb can borrow: its stake times (top leverage - 1); a pack
/// climb, played with the reserve's money, borrows its whole position.
pub fn line_of(stake: u64, top: u8, pack: bool) -> u64 {
    let lev10 = LADDER[top as usize] as u64;
    if pack {
        stake * lev10 / 10
    } else {
        stake * (lev10 - 10) / 10
    }
}

/// Borrowed at a ladder step: stake x (leverage - 1).
pub fn borrowed_at(stake: u64, step: u8) -> u64 {
    stake * (LADDER[step as usize] as u64 - 10) / 10
}

/// What a solo climb pays for its loan: a fee of `BORROW_FEE_BPS` on the peak
/// borrow, plus interest at `BORROW_APR_BPS` on what was borrowed each second
/// of the climb (the ladder steps up every 6 s, capped at `top`).
pub fn borrow_cost(stake: u64, seconds: i64, top: u8, max_step: u8) -> u64 {
    let fee = borrowed_at(stake, max_step) as u128 * BORROW_FEE_BPS as u128 / BPS as u128;
    let secs = seconds.clamp(0, RUN_SECONDS);
    let mut lev_seconds: u128 = 0; // sum over seconds of (leverage - 1), in tenths
    for t in 0..secs {
        lev_seconds += (LADDER[step_at(t, top) as usize] - 10) as u128;
    }
    let interest = stake as u128 * lev_seconds * BORROW_APR_BPS as u128 / (10 * BPS as u128 * SECONDS_PER_YEAR as u128);
    (fee + interest) as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::TOP_STEP;

    #[test]
    fn shares_track_assets() {
        // first deposit 1:1
        assert_eq!(shares_for(1_000, 0, 0), 1_000);
        // the pool earned 10 %: a new deposit buys fewer shares, rounded down
        assert_eq!(shares_for(1_100, 1_100, 1_000), 1_000);
        assert_eq!(shares_for(1_000, 1_100, 1_000), 909);
        // and a share is worth more
        assert_eq!(value_of(1_000, 1_100, 1_000), 1_100);
        assert_eq!(value_of(0, 1_100, 1_000), 0);
        // deposit then withdraw never returns more than was put in
        let (a, s) = (1_234_567u64, 1_000_003u64);
        let n = shares_for(777, a, s);
        assert!(value_of(n, a + 777, s + n) <= 777);
        // stakes in flight are not the lenders' money
        assert_eq!(assets_of(5_000, 300), 4_700);
        assert_eq!(assets_of(100, 300), 0);
    }

    #[test]
    fn lines_and_exposure() {
        assert_eq!(exposure_of(10_000_000), 40_000_000);
        // 4x top: a solo climb borrows up to 3 x its stake, a pack its whole position
        assert_eq!(line_of(10_000_000, TOP_STEP, false), 30_000_000);
        assert_eq!(line_of(10_000_000, TOP_STEP, true), 40_000_000);
        assert_eq!(line_of(10_000_000, 1, true), 15_000_000);
        assert!(exposure_of(7) >= line_of(7, TOP_STEP, false));
        assert_eq!(borrowed_at(25_000_000, 0), 0);
        assert_eq!(borrowed_at(25_000_000, 2), 25_000_000);
    }

    #[test]
    fn borrow_cost_is_fee_plus_per_second_interest() {
        // no borrow at 1x
        assert_eq!(borrow_cost(100_000_000, 5, TOP_STEP, 0), 0);
        // a full minute at 100 tUSDC: steps 0..5 last 6 s each, step 6 (4x) 24 s
        // lev-1 seconds in tenths: 6*(0+5+10+15+20+25) + 24*30 = 1,170
        let full = borrow_cost(100_000_000, 60, TOP_STEP, 6);
        let fee = 300_000_000u64 * 10 / 10_000; // 0.1 % of 300 tUSDC borrowed at the peak
        let interest = (100_000_000u128 * 1_170 * 3_650 / (10 * 10_000 * 31_536_000u128)) as u64;
        assert_eq!(full, fee + interest);
        assert_eq!(fee, 300_000);
        assert_eq!(interest, 135); // 0.000135 tUSDC: a minute of interest is tiny, the fee dominates
        // past the bell nothing more accrues
        assert_eq!(borrow_cost(100_000_000, 90, TOP_STEP, 6), full);
        // a pack-capped ladder borrows less
        assert!(borrow_cost(100_000_000, 60, 1, 1) < full);
    }
}
