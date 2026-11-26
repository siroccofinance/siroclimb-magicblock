//! Game state and rules, free of account plumbing so they can be unit tested
//! on the host: the leverage ladder, how a position moves with the price,
//! profiles and leverage packs.
use anchor_lang::prelude::*;

use crate::desk::{ask, bid, units_for, EXPONENTS};
use crate::reserve::{borrowed_at, MAX_PAYOUT_MULT};

/// TSLAx, NVDAx, AAPLx, XAU (gold, as XAUt), MSTRx, in that order everywhere.
pub const ASSETS: usize = 5;

/// Leverage ladder in tenths: 1x, 1.5x, 2x ... 4x, one step every 6 s.
pub const LADDER: [u16; 7] = [10, 15, 20, 25, 30, 35, 40];
pub const TOP_STEP: u8 = (LADDER.len() - 1) as u8;
pub const STEP_SECONDS: i64 = 6;
pub const RUN_SECONDS: i64 = 60;

/// Real minute-scale moves are tiny (Tesla moves about 0.07 % in three
/// minutes, gold less), so each market's move is magnified
/// before the ladder's leverage applies: with a boost of 90 a 0.1 % move of
/// TSLAx moves the climb like a 9 % move at 1x. Tuned per market from the live
/// feeds' per-second volatility, so every market plays about as lively.
pub const BOOST: [u32; ASSETS] = [90, 25, 90, 60, 25];

/// Fixed point of price returns: 1e9 = +100 %.
pub const PPB: i128 = 1_000_000_000;

pub const SIDE_LONG: u8 = 0;
pub const SIDE_SHORT: u8 = 1;

pub const MODE_SOLO: u8 = 0;
/// 1 was the retired round mode (older profile history may hold it).
pub const MODE_PACK: u8 = 2;

// Run status.
pub const RUN_FREE: u8 = 0;
pub const RUN_STAKED: u8 = 1;
pub const RUN_LIVE: u8 = 2;
pub const RUN_CASHED: u8 = 3;
pub const RUN_BUSTED: u8 = 4;
pub const RUN_EXPIRED: u8 = 5;
pub const RUN_SETTLED: u8 = 6;

pub const NAME_LEN: usize = 16;
pub const HISTORY: usize = 8;
pub const NONE: u8 = 255;

// Leverage packs: the VRF draws a tier, the tier sets how high the free climb's ladder goes.
pub const PACK_NONE: u8 = 0;
pub const PACK_DRAWING: u8 = 1;
pub const PACK_READY: u8 = 2;
/// Bronze 1.5x, Silver 2x, Gold 3x, Diamond 4x: the top ladder step of each tier.
pub const PACK_TOP_STEP: [u8; 4] = [1, 2, 4, 6];
/// Odds out of 100: 45 / 28 / 18 / 9.
pub const PACK_ODDS: [u8; 4] = [45, 28, 18, 9];

#[error_code]
pub enum ClimbError {
    #[msg("Not authorised")]
    Unauthorized,
    #[msg("Session key expired")]
    SessionExpired,
    #[msg("Not a token account of the right mint and owner")]
    BadTokenAccount,
    #[msg("Wrong mint")]
    BadMint,
    #[msg("Wrong vault")]
    BadVault,
    #[msg("Not enough test USDC")]
    InsufficientFunds,
    #[msg("Faucet cooldown")]
    FaucetCooldown,
    #[msg("Unknown market")]
    BadAsset,
    #[msg("Side must be long or short")]
    BadSide,
    #[msg("Stake out of range")]
    BadStake,
    #[msg("A run is already in progress")]
    RunInProgress,
    #[msg("Wrong status for this action")]
    BadStatus,
    #[msg("Wrong price feed")]
    WrongFeed,
    #[msg("Price feed is stale (market closed?)")]
    StalePrice,
    #[msg("Bad price")]
    BadPrice,
    #[msg("Too early")]
    TooEarly,
    #[msg("Too late")]
    TooLate,
    // Round errors are from the retired round mode, kept so later codes do not shift.
    #[msg("Wrong round slot")]
    BadRound,
    #[msg("Round slot still in use")]
    SlotBusy,
    #[msg("Round is full")]
    RoundFull,
    #[msg("Already in this round")]
    AlreadyJoined,
    #[msg("Not in this round")]
    NotInRound,
    #[msg("Wrong winner account")]
    BadWinner,
    #[msg("No pack to use")]
    NoPack,
    #[msg("Pack cooldown")]
    PackCooldown,
    #[msg("Crank scheduling failed")]
    Crank,
    #[msg("This market is outside its trading sessions")]
    MarketClosed,
    #[msg("The Sirocco Reserve cannot cover this climb right now")]
    ReserveFull,
    #[msg("Not enough free liquidity in the reserve")]
    NotEnoughLiquidity,
    #[msg("Not enough reserve shares")]
    BadShares,
    #[msg("The climb has no position yet")]
    NoPosition,
}

/// The ladder step at `t` seconds into a climb, capped at `top`.
pub fn step_at(t: i64, top: u8) -> u8 {
    let s = if t <= 0 { 0 } else { (t / STEP_SECONDS).min(TOP_STEP as i64) as u8 };
    s.min(top)
}

/// A position after the price moved from `last` to `price` at leverage
/// `lev10` (tenths). Floored at zero: a stake can be lost, never more.
pub fn moved(value: u64, lev10: u16, side: u8, boost: u32, last: u64, price: u64) -> u64 {
    if last == 0 || price == 0 || value == 0 {
        return value;
    }
    let r = (price as i128 - last as i128) * PPB / last as i128;
    let signed = if side == SIDE_SHORT { -r } else { r };
    let change = value as i128 * lev10 as i128 * boost as i128 * signed / (10 * PPB);
    let v = value as i128 + change;
    if v <= 0 {
        0
    } else {
        v.min(u64::MAX as i128) as u64
    }
}

/// Profit in basis points of the stake.
pub fn pnl_bps(value: u64, stake: u64) -> i32 {
    if stake == 0 {
        return 0;
    }
    ((value as i128 - stake as i128) * 10_000 / stake as i128).clamp(i32::MIN as i128, i32::MAX as i128) as i32
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace, Debug, PartialEq)]
pub struct RunRecord {
    pub ts: i64,
    pub stake: u64,
    /// Money won or lost: payout minus stake.
    pub pnl: i64,
    /// Position result in bps of the stake.
    pub pnl_bps: i32,
    pub asset: u8,
    pub side: u8,
    pub mode: u8,
    pub status: u8,
    pub max_step: u8,
    /// Round finish (1-based) in the retired round mode, 0 for solo.
    pub rank: u8,
    pub players: u8,
}

/// A player's on-chain identity and record: handle, counters, bests, the last
/// climbs, and a leverage pack when one is waiting.
#[account]
#[derive(InitSpace)]
pub struct Profile {
    pub authority: Pubkey,
    pub name: [u8; NAME_LEN],
    pub created_ts: i64,
    pub runs: u32,
    pub cashed: u32,
    pub busted: u32,
    pub expired: u32,
    pub volume: u64,
    pub total_pnl: i64,
    pub best_bps: i32,
    /// Day (unix days) of `day_best_bps`.
    pub day: u32,
    pub day_best_bps: i32,
    /// From the retired round mode; kept so profiles keep their layout.
    pub rounds: u32,
    pub podiums: u32,
    pub wins: u32,
    pub prizes: u64,
    pub pack_state: u8,
    pub pack_tier: u8,
    pub pack_ts: i64,
    pub packs: u32,
    pub head: u8,
    pub history: [RunRecord; HISTORY],
    pub bump: u8,
}

impl Profile {
    pub fn record(&mut self, r: RunRecord) {
        self.runs += 1;
        match r.status {
            RUN_CASHED => self.cashed += 1,
            RUN_BUSTED => self.busted += 1,
            _ => self.expired += 1,
        }
        if r.mode != MODE_PACK {
            self.volume += r.stake;
        }
        self.total_pnl += r.pnl;
        if self.runs == 1 || r.pnl_bps > self.best_bps {
            self.best_bps = r.pnl_bps;
        }
        let day = (r.ts.max(0) / 86_400) as u32;
        if day != self.day {
            self.day = day;
            self.day_best_bps = r.pnl_bps;
        } else if r.pnl_bps > self.day_best_bps {
            self.day_best_bps = r.pnl_bps;
        }
        self.history[self.head as usize % HISTORY] = r;
        self.head = ((self.head as usize + 1) % HISTORY) as u8;
    }
}

/// A solo climb. One per player, reused: free -> staked (on Solana) -> live
/// (on the rollup) -> cashed / busted / expired -> settled (back on Solana).
#[account]
#[derive(InitSpace)]
pub struct Run {
    pub player: Pubkey,
    /// The key allowed to act for the player on the rollup (session key or wallet).
    pub session: Pubkey,
    pub nonce: u32,
    pub status: u8,
    pub mode: u8,
    pub asset: u8,
    pub side: u8,
    /// Highest ladder step this climb may reach (packs cap it).
    pub top: u8,
    pub pack_tier: u8,
    pub stake: u64,
    pub value: u64,
    pub entry_price: u64,
    pub last_price: u64,
    pub created_ts: i64,
    pub start_ts: i64,
    pub last_tick_ts: i64,
    pub end_ts: i64,
    pub max_step: u8,
    pub ticks: u32,
    pub payout: u64,
    pub task_id: i64,
    pub bump: u8,
    // Sirocco Reserve (appended: older run accounts are grown by `grow_run`).
    /// Borrowed from the reserve right now: stake x (leverage - 1), live on the rollup.
    pub borrowed: u64,
    /// Borrow fee + interest charged at settlement (solo climbs).
    pub cost: u64,
    /// Liquidity reserved for this climb, and its borrow line, released at settlement.
    pub reserved: u64,
    pub line: u64,
    // Real position (appended: older run accounts are grown by `grow_run`), see `desk.rs`.
    /// Market token units bought (long) or borrowed and sold (short) at the opening fill, in the escrow
    /// for the whole climb (long), and in total including the leverage steps booked on the rollup.
    pub units_open: u64,
    pub units: u64,
    /// tUSDC paid for those units (long) or received for them (short): at the opening fill, and in total.
    pub notional_open: u64,
    pub notional: u64,
    /// Opening fill price and closing fill price (raw, the relay's units, spread included).
    pub fill_price: u64,
    pub exit_fill: u64,
    /// Last ladder step whose fill is booked.
    pub booked_step: u8,
    pub spread_bps: u16,
    pub decimals: u8,
    /// At settlement: what the tokens made, and the rest of the climb's result (the game's boost).
    pub real_pnl: i64,
    pub boost_pnl: i64,
}

impl Run {
    pub fn is_over(&self) -> bool {
        matches!(self.status, RUN_CASHED | RUN_BUSTED | RUN_EXPIRED)
    }

    /// Move the climb to `price` at `now`. Busts at zero, expires at 60 s.
    pub fn advance(&mut self, price: u64, now: i64) {
        if self.status != RUN_LIVE {
            return;
        }
        let t = (now - self.start_ts).min(RUN_SECONDS);
        let step = step_at(t, self.top);
        self.value = moved(self.value, LADDER[step as usize], self.side, BOOST[self.asset as usize], self.last_price, price)
            .min(self.stake.saturating_mul(MAX_PAYOUT_MULT));
        self.borrowed = borrowed_at(self.stake, step);
        self.book_steps(step, price);
        self.last_price = price;
        self.last_tick_ts = now;
        self.ticks += 1;
        self.max_step = self.max_step.max(step);
        if self.value == 0 {
            self.status = RUN_BUSTED;
            self.end_ts = now;
        } else if now - self.start_ts >= RUN_SECONDS {
            self.status = RUN_EXPIRED;
            self.end_ts = self.start_ts + RUN_SECONDS;
        }
    }

    /// Each new leverage step adds stake x 0.5 of position: a long buys that much more of the token
    /// with the money it borrows, a short borrows and sells that much more, at this tick's price.
    pub fn book_steps(&mut self, step: u8, price: u64) {
        if self.units_open == 0 || price == 0 {
            return;
        }
        while self.booked_step < step {
            let s = self.booked_step as usize + 1;
            let usdc = self.stake * (LADDER[s] - LADDER[s - 1]) as u64 / 10;
            let px = if self.side == SIDE_SHORT { bid(price, self.spread_bps) } else { ask(price, self.spread_bps) };
            self.units += units_for(usdc, px, EXPONENTS[self.asset as usize], self.decimals);
            self.notional += usdc;
            self.booked_step += 1;
        }
    }

    /// What settlement pays back: the position less the borrow cost, or for a
    /// free pack climb only the gain.
    pub fn payout_for(&self) -> u64 {
        if self.mode == MODE_PACK {
            self.value.saturating_sub(self.stake)
        } else {
            self.value.saturating_sub(self.cost)
        }
    }
}

pub fn pack_tier_from(randomness: &[u8; 32]) -> u8 {
    let r = (u64::from_le_bytes(randomness[..8].try_into().unwrap()) % 100) as u8;
    let mut acc = 0u8;
    for (i, o) in PACK_ODDS.iter().enumerate() {
        acc += o;
        if r < acc {
            return i as u8;
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ladder_steps_every_six_seconds_and_caps() {
        assert_eq!(step_at(0, TOP_STEP), 0);
        assert_eq!(step_at(5, TOP_STEP), 0);
        assert_eq!(step_at(6, TOP_STEP), 1);
        assert_eq!(step_at(35, TOP_STEP), 5);
        assert_eq!(step_at(36, TOP_STEP), 6);
        assert_eq!(step_at(60, TOP_STEP), 6);
        assert_eq!(step_at(60, 2), 2);
    }

    #[test]
    fn moves_with_leverage_boost_and_side() {
        // +0.1 % at 2x with boost 40: +8 %.
        let v = moved(10_000_000, 20, SIDE_LONG, 40, 1_000_000, 1_001_000);
        assert_eq!(v, 10_800_000);
        let v = moved(10_000_000, 20, SIDE_SHORT, 40, 1_000_000, 1_001_000);
        assert_eq!(v, 9_200_000);
        // Never below zero.
        assert_eq!(moved(10_000_000, 40, SIDE_LONG, 40, 1_000_000, 990_000), 0);
    }

    fn live_run() -> Run {
        Run {
            player: Pubkey::new_unique(),
            session: Pubkey::default(),
            nonce: 1,
            status: RUN_LIVE,
            mode: MODE_SOLO,
            asset: 0,
            side: SIDE_LONG,
            top: TOP_STEP,
            pack_tier: NONE,
            stake: 10_000_000,
            value: 10_000_000,
            entry_price: 1_000_000,
            last_price: 1_000_000,
            created_ts: 0,
            start_ts: 1000,
            last_tick_ts: 1000,
            end_ts: 0,
            max_step: 0,
            ticks: 0,
            payout: 0,
            task_id: 0,
            bump: 0,
            borrowed: 0,
            cost: 0,
            reserved: 0,
            line: 0,
            units_open: 0,
            units: 0,
            notional_open: 0,
            notional: 0,
            fill_price: 0,
            exit_fill: 0,
            booked_step: 0,
            spread_bps: 0,
            decimals: 0,
            real_pnl: 0,
            boost_pnl: 0,
        }
    }

    #[test]
    fn leverage_steps_buy_more_tokens_at_the_tick_price() {
        let mut r = live_run();
        // opened 10 tUSDC long of an 8-decimal token at 1.00000 (raw 100_000, exp -5) + 5 bps
        r.asset = 0;
        r.entry_price = 100_000;
        r.last_price = 100_000;
        r.spread_bps = 5;
        r.decimals = 8;
        r.units_open = crate::desk::units_for(10_000_000, 100_050, -5, 8);
        r.units = r.units_open;
        r.notional_open = 10_000_000;
        r.notional = 10_000_000;
        r.advance(100_000, 1013); // two steps (1.5x, 2x): 10 tUSDC more, bought at 1.0005
        assert_eq!(r.booked_step, 2);
        assert_eq!(r.notional, 20_000_000);
        assert!(r.units.abs_diff(2 * r.units_open) <= 2);
        r.advance(110_000, 1019); // step 3 at 1.10: 5 tUSDC buys fewer tokens
        assert_eq!(r.booked_step, 3);
        assert_eq!(r.notional, 25_000_000);
        assert!((r.units - 2 * r.units_open).abs_diff(crate::desk::units_for(5_000_000, crate::desk::ask(110_000, 5), -5, 8)) <= 2);
        // a short books the same notional, sold at the bid
        let mut s = live_run();
        s.side = SIDE_SHORT;
        s.spread_bps = 5;
        s.decimals = 8;
        s.units_open = 1;
        s.units = 1;
        s.notional_open = 10_000_000;
        s.notional = 10_000_000;
        s.advance(1_000_000, 1007);
        assert_eq!(s.notional, 15_000_000);
        assert_eq!(s.units, 1 + crate::desk::units_for(5_000_000, crate::desk::bid(1_000_000, 5), -5, 8));
        // a climb without a position books nothing
        let mut n = live_run();
        n.advance(1_000_000, 1013);
        assert_eq!(n.units, 0);
    }

    #[test]
    fn value_is_capped_and_borrow_follows_the_ladder() {
        let mut r = live_run();
        r.advance(1_000_000, 1013); // step 2: 2x
        assert_eq!(r.borrowed, 10_000_000);
        r.advance(2_000_000, 1040); // +100 % at 4x, boost 90: far past the cap
        assert_eq!(r.value, 50_000_000);
        assert_eq!(r.borrowed, 30_000_000);
        r.cost = 400_000;
        assert_eq!(r.payout_for(), 49_600_000);
    }

    #[test]
    fn run_busts_and_expires() {
        let mut r = live_run();
        r.advance(1_000_500, 1012); // +0.05 % at step 2 (2x), TSLAx boost 90: +9 %
        assert_eq!(r.value, 10_900_000);
        assert_eq!(r.max_step, 2);
        r.advance(900_000, 1013);
        assert_eq!(r.status, RUN_BUSTED);
        assert_eq!(r.value, 0);
        let mut r = live_run();
        r.advance(1_000_000, 1061);
        assert_eq!(r.status, RUN_EXPIRED);
        assert_eq!(r.end_ts, 1060);
        // Further ticks change nothing.
        r.advance(2_000_000, 1062);
        assert_eq!(r.value, 10_000_000);
    }

    #[test]
    fn pack_runs_pay_only_the_gain() {
        let mut r = live_run();
        r.mode = MODE_PACK;
        r.value = 12_000_000;
        assert_eq!(r.payout_for(), 2_000_000);
        r.value = 7_000_000;
        assert_eq!(r.payout_for(), 0);
    }

    #[test]
    fn profile_keeps_bests_and_history() {
        let mut p = Profile {
            authority: Pubkey::default(),
            name: [0; NAME_LEN],
            created_ts: 0,
            runs: 0,
            cashed: 0,
            busted: 0,
            expired: 0,
            volume: 0,
            total_pnl: 0,
            best_bps: 0,
            day: 0,
            day_best_bps: 0,
            rounds: 0,
            podiums: 0,
            wins: 0,
            prizes: 0,
            pack_state: 0,
            pack_tier: 0,
            pack_ts: 0,
            packs: 0,
            head: 0,
            history: [RunRecord::default(); HISTORY],
            bump: 0,
        };
        let rec = |ts, bps, status| RunRecord { ts, stake: 10, pnl: bps as i64, pnl_bps: bps, status, ..Default::default() };
        p.record(rec(86_400 * 5, -300, RUN_BUSTED));
        assert_eq!(p.best_bps, -300);
        p.record(rec(86_400 * 5 + 10, 450, RUN_CASHED));
        assert_eq!((p.best_bps, p.day_best_bps, p.day), (450, 450, 5));
        p.record(rec(86_400 * 6, 100, RUN_CASHED));
        assert_eq!((p.best_bps, p.day_best_bps, p.day), (450, 100, 6));
        for i in 0..10 {
            p.record(rec(86_400 * 6 + i, 1, RUN_EXPIRED));
        }
        assert_eq!(p.runs, 13);
        assert_eq!(p.head as usize, 13 % HISTORY);
    }

    #[test]
    fn pack_odds_cover_every_tier() {
        let mut seen = [0u32; 4];
        for i in 0..1000u64 {
            let mut r = [0u8; 32];
            r[..8].copy_from_slice(&i.to_le_bytes());
            seen[pack_tier_from(&r) as usize] += 1;
        }
        assert_eq!(seen, [450, 280, 180, 90]);
    }
}
