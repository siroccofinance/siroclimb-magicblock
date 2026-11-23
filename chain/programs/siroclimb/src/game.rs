//! Game state and rules, free of account plumbing so they can be unit tested
//! on the host: the leverage ladder, how a position moves with the price, how
//! a round ranks its players and splits its pot, profiles and leverage packs.
use anchor_lang::prelude::*;

/// TSLAx, NVDAx, AAPLx, XAU (gold), GBP/USD, in that order everywhere.
pub const ASSETS: usize = 5;
/// GBP/USD has no MagicBlock feed on the rollups: its price lives in a relay account.
pub const RELAY_ASSET: u8 = 4;

/// Leverage ladder in tenths: 1x, 1.5x, 2x ... 4x, one step every 6 s.
pub const LADDER: [u16; 7] = [10, 15, 20, 25, 30, 35, 40];
pub const TOP_STEP: u8 = (LADDER.len() - 1) as u8;
pub const STEP_SECONDS: i64 = 6;
pub const RUN_SECONDS: i64 = 60;

/// Real minute-scale moves are tiny (Tesla moves about 0.07 % in three
/// minutes, gold and the pound far less), so each market's move is magnified
/// before the ladder's leverage applies: with a boost of 90 a 0.1 % move of
/// TSLAx moves the climb like a 9 % move at 1x. Tuned per market from the live
/// feeds' per-second volatility, so every market plays about as lively.
pub const BOOST: [u32; ASSETS] = [90, 25, 90, 180, 400];

/// Fixed point of price returns: 1e9 = +100 %.
pub const PPB: i128 = 1_000_000_000;

pub const SIDE_LONG: u8 = 0;
pub const SIDE_SHORT: u8 = 1;

pub const MODE_SOLO: u8 = 0;
pub const MODE_ROUND: u8 = 1;
pub const MODE_PACK: u8 = 2;

// Run (and round entry) status.
pub const RUN_FREE: u8 = 0;
pub const RUN_STAKED: u8 = 1;
pub const RUN_LIVE: u8 = 2;
pub const RUN_CASHED: u8 = 3;
pub const RUN_BUSTED: u8 = 4;
pub const RUN_EXPIRED: u8 = 5;
pub const RUN_SETTLED: u8 = 6;

// Round status.
pub const ROUND_FREE: u8 = 0;
pub const ROUND_DRAWING: u8 = 1;
pub const ROUND_OPEN: u8 = 2;
pub const ROUND_LIVE: u8 = 3;
pub const ROUND_FINISHED: u8 = 4;
pub const ROUND_SETTLED: u8 = 5;

/// Rounds follow a fixed clock: round `n` opens at `n * CYCLE`, takes joins
/// for `ROUND_JOIN_SECONDS`, then runs for `RUN_SECONDS`.
pub const ROUND_CYCLE: i64 = 80;
pub const ROUND_JOIN_SECONDS: i64 = 20;
/// Round accounts are a ring of reusable slots (round `n` lives in slot `n % SLOTS`).
pub const ROUND_SLOTS: u64 = 4;
pub const MAX_PLAYERS: usize = 24;
pub const PRIZE_SPLIT: [u64; 3] = [50, 30, 20];

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
    /// Money won or lost: payout minus stake (solo), prize minus entry (round).
    pub pnl: i64,
    /// Position result in bps of the stake.
    pub pnl_bps: i32,
    pub asset: u8,
    pub side: u8,
    pub mode: u8,
    pub status: u8,
    pub max_step: u8,
    /// Round finish (1-based), 0 for solo.
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
        if r.mode == MODE_ROUND {
            self.rounds += 1;
            if r.rank >= 1 && r.rank <= 3 {
                self.podiums += 1;
            }
            if r.rank == 1 {
                self.wins += 1;
            }
            if r.pnl > -(r.stake as i64) {
                self.prizes += (r.pnl + r.stake as i64) as u64;
            }
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
        self.value = moved(self.value, LADDER[step as usize], self.side, BOOST[self.asset as usize], self.last_price, price);
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

    /// What settlement pays back: the position, or for a free pack climb only the gain.
    pub fn payout_for(&self) -> u64 {
        if self.mode == MODE_PACK {
            self.value.saturating_sub(self.stake)
        } else {
            self.value
        }
    }
}

/// One player's climb inside a round.
#[zero_copy]
#[derive(Default, Debug, PartialEq)]
pub struct RoundEntry {
    pub player: Pubkey,
    pub session: Pubkey,
    pub value: u64,
    pub end_ts: i64,
    pub name: [u8; NAME_LEN],
    pub side: u8,
    pub status: u8,
    pub max_step: u8,
    pub _pad: [u8; 5],
}

/// A timed round: everyone on the same market, same entry, same 60 s.
/// Zero-copy: with 24 seats it is too big to deserialize on the stack.
#[account(zero_copy)]
pub struct Round {
    pub id: u64,
    pub opens_at: i64,
    pub starts_at: i64,
    pub ends_at: i64,
    pub entry: u64,
    pub pot: u64,
    pub entry_price: u64,
    pub last_price: u64,
    pub live_ts: i64,
    pub last_tick_ts: i64,
    pub task_id: i64,
    pub settled_ts: i64,
    pub prizes: [u64; 3],
    pub entries: [RoundEntry; MAX_PLAYERS],
    pub ticks: u32,
    /// Bit i set once entry i's result is written to its profile.
    pub recorded: u32,
    pub slot: u8,
    pub status: u8,
    pub asset: u8,
    pub players: u8,
    pub bump: u8,
    /// Entry index of the 1st, 2nd and 3rd place (NONE when fewer players).
    pub winners: [u8; 3],
}

pub fn round_times(id: u64) -> (i64, i64, i64) {
    let opens = id as i64 * ROUND_CYCLE;
    (opens, opens + ROUND_JOIN_SECONDS, opens + ROUND_JOIN_SECONDS + RUN_SECONDS)
}

impl Round {
    /// Reuse the slot for round `id`. Clears in place (the account is too big for the stack).
    pub fn reset(&mut self, id: u64, entry: u64) {
        let (o, s, e) = round_times(id);
        self.id = id;
        self.status = ROUND_DRAWING;
        self.asset = NONE;
        self.opens_at = o;
        self.starts_at = s;
        self.ends_at = e;
        self.entry = entry;
        self.pot = 0;
        self.players = 0;
        self.entry_price = 0;
        self.last_price = 0;
        self.live_ts = 0;
        self.last_tick_ts = 0;
        self.ticks = 0;
        self.recorded = 0;
        self.winners = [NONE; 3];
        self.prizes = [0; 3];
        self.task_id = 0;
        self.settled_ts = 0;
        for x in self.entries.iter_mut() {
            *x = RoundEntry::default();
        }
    }

    #[cfg(test)]
    pub fn blank() -> Round {
        // Plain old data: all zeroes is a valid free slot.
        unsafe { std::mem::zeroed() }
    }

    pub fn index_of(&self, player: &Pubkey) -> Option<usize> {
        self.entries[..self.players as usize].iter().position(|e| e.player == *player)
    }

    pub fn session_index(&self, signer: &Pubkey) -> Option<usize> {
        self.entries[..self.players as usize].iter().position(|e| e.session == *signer || e.player == *signer)
    }

    /// Move every live climb to `price` at `now`; at the bell the rest expire.
    pub fn advance(&mut self, price: u64, now: i64) {
        if self.status != ROUND_LIVE {
            return;
        }
        let t = (now - self.live_ts).min(RUN_SECONDS);
        let step = step_at(t, TOP_STEP);
        let over = now >= self.live_ts + RUN_SECONDS;
        for e in self.entries[..self.players as usize].iter_mut() {
            if e.status != RUN_LIVE {
                continue;
            }
            e.value = moved(e.value, LADDER[step as usize], e.side, BOOST[self.asset as usize], self.last_price, price);
            e.max_step = e.max_step.max(step);
            if e.value == 0 {
                e.status = RUN_BUSTED;
                e.end_ts = now;
            } else if over {
                e.status = RUN_EXPIRED;
                e.end_ts = self.live_ts + RUN_SECONDS;
            }
        }
        self.last_price = price;
        self.last_tick_ts = now;
        self.ticks += 1;
        if over {
            self.status = ROUND_FINISHED;
            self.rank();
        }
    }

    /// Order the field by final position (ties: who joined first) and fix the prizes.
    pub fn rank(&mut self) {
        let n = self.players as usize;
        let mut order: Vec<usize> = (0..n).collect();
        order.sort_by(|a, b| self.entries[*b].value.cmp(&self.entries[*a].value).then(a.cmp(b)));
        let paid = n.min(3);
        let total: u64 = PRIZE_SPLIT[..paid].iter().sum();
        let mut left = self.pot;
        self.winners = [NONE; 3];
        self.prizes = [0; 3];
        for (k, idx) in order.iter().take(paid).enumerate() {
            let p = if k + 1 == paid { left } else { self.pot * PRIZE_SPLIT[k] / total };
            left -= p;
            self.winners[k] = *idx as u8;
            self.prizes[k] = p;
        }
    }

    /// 1-based finish of entry `i` (all entries ranked by value).
    pub fn place_of(&self, i: usize) -> u8 {
        let v = self.entries[i].value;
        let ahead = self.entries[..self.players as usize]
            .iter()
            .enumerate()
            .filter(|(j, e)| e.value > v || (e.value == v && *j < i))
            .count();
        (ahead + 1) as u8
    }

    pub fn prize_of(&self, i: usize) -> u64 {
        self.winners.iter().position(|w| *w as usize == i).map(|k| self.prizes[k]).unwrap_or(0)
    }
}

/// Pick a pack tier from 32 bytes of randomness.
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
        }
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

    fn round_with(values: &[u64]) -> Round {
        let mut r = Round::blank();
        r.reset(10, 10_000_000);
        r.status = ROUND_LIVE;
        r.asset = 0;
        r.players = values.len() as u8;
        r.pot = 10_000_000 * values.len() as u64;
        for (i, v) in values.iter().enumerate() {
            r.entries[i].value = *v;
            r.entries[i].status = RUN_CASHED;
        }
        r
    }

    #[test]
    fn round_splits_the_pot_50_30_20() {
        let mut r = round_with(&[9, 12, 11, 15, 3]);
        r.rank();
        assert_eq!(r.winners, [3, 1, 2]);
        assert_eq!(r.prizes, [25_000_000, 15_000_000, 10_000_000]);
        assert_eq!(r.place_of(3), 1);
        assert_eq!(r.place_of(4), 5);
        assert_eq!(r.prize_of(1), 15_000_000);
        assert_eq!(r.prize_of(0), 0);
    }

    #[test]
    fn small_rounds_renormalise_and_ties_go_to_the_first_joiner() {
        let mut r = round_with(&[5]);
        r.rank();
        assert_eq!(r.prizes[0], 10_000_000);
        let mut r = round_with(&[7, 7]);
        r.rank();
        assert_eq!(r.winners[..2], [0, 1]);
        assert_eq!(r.prizes[0] + r.prizes[1], 20_000_000);
        assert_eq!(r.prizes[0], 12_500_000);
        assert_eq!(r.place_of(1), 2);
    }

    #[test]
    fn round_advance_ends_at_the_bell() {
        let mut r = round_with(&[10_000_000, 10_000_000]);
        r.entries[0].status = RUN_LIVE;
        r.entries[1].status = RUN_LIVE;
        r.entries[1].side = SIDE_SHORT;
        r.live_ts = 100;
        r.last_price = 1_000_000;
        r.advance(1_001_000, 101);
        assert!(r.entries[0].value > r.entries[1].value);
        r.advance(1_001_000, 160);
        assert_eq!(r.status, ROUND_FINISHED);
        assert_eq!(r.entries[0].status, RUN_EXPIRED);
        assert_eq!(r.winners[0], 0);
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
