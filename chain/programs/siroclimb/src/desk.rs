//! Real positions: every climb holds real market tokens.
//!
//! The Sirocco desk is a program-owned swap venue that quotes each market's
//! token (the xStock mirrors, and an XAUt mirror for gold) at the live price
//! plus or minus a small spread, and holds inventories of those tokens and of
//! tUSDC. A stock-lending book, also program-owned, lends the tokens shorts
//! sell.
//!
//! - LONG: the climb's tUSDC (the stake, then at every leverage step the money
//!   borrowed from the Sirocco Reserve) buys the token from the desk. The
//!   tokens sit in the climb's escrow (a token account owned by the run PDA).
//!   At settlement they are sold back to the desk at the exit price.
//! - SHORT: the climb borrows the token from the lending book and sells it to
//!   the desk for tUSDC (kept by the reserve as collateral). At settlement it
//!   buys the tokens back from the desk at the exit price and returns them.
//!
//! The opening fill (1x: the stake's worth) happens on Solana when the climb
//! starts, at the relay's price pushed on Solana (`Quotes`): those tokens are
//! in the escrow for the whole climb. Each leverage step is filled on the
//! rollup at that tick's price and booked in the run; the booked tokens and
//! tUSDC move on Solana at settlement, together with the closing trade.
//!
//! The game keeps its amplification (the market's boost): the position's real
//! P&L is what the tokens made; the rest of the climb's result (the boost) is
//! settled between the player and the reserve, as before.
use anchor_lang::prelude::*;

use crate::game::ASSETS;

pub const DESK_SEED: &[u8] = b"desk";
pub const QUOTES_SEED: &[u8] = b"quotes";
pub const LEND_SEED: &[u8] = b"stock_lend";

/// Relay price exponent per market (TSLAx, NVDAx, AAPLx, XAUt, GMEx).
pub const EXPONENTS: [i32; ASSETS] = [-5, -5, -5, -3, -5];
/// Decimals of tUSDC.
pub const USDC_DECIMALS: u32 = 6;
/// A Solana quote older than this cannot open a position.
pub const QUOTE_MAX_AGE: i64 = 30;
const BPS: u64 = 10_000;

/// The desk: spread, the token of each market and the tUSDC it has in open positions.
#[account]
#[derive(InitSpace)]
pub struct Desk {
    pub admin: Pubkey,
    pub spread_bps: u16,
    pub mints: [Pubkey; ASSETS],
    pub decimals: [u8; ASSETS],
    /// tUSDC the reserve paid the desk for the tokens long climbs hold right now (opening fills).
    pub open_long_cost: u64,
    /// tUSDC the reserve received from the desk for the tokens short climbs sold (opening fills).
    pub open_short_proceeds: u64,
    pub trades: u64,
    /// tUSDC traded with the desk.
    pub volume: u64,
    pub bump: u8,
}

/// The relay's prices pushed on Solana (same raw units as the rollup relays), for opening fills.
#[account]
#[derive(InitSpace)]
pub struct Quotes {
    pub relayer: Pubkey,
    pub prices: [u64; ASSETS],
    pub ts: i64,
    pub updates: u64,
    pub bump: u8,
}

pub fn ask(price: u64, spread_bps: u16) -> u64 {
    (price as u128 * (BPS + spread_bps as u64) as u128 / BPS as u128) as u64
}

pub fn bid(price: u64, spread_bps: u16) -> u64 {
    (price as u128 * (BPS - spread_bps as u64) as u128 / BPS as u128) as u64
}

fn pow10(n: u32) -> u128 {
    10u128.pow(n)
}

/// Token base units that `usdc` (6 decimals) buys at `price` (raw, `exp`), for a token of `dec` decimals.
pub fn units_for(usdc: u64, price: u64, exp: i32, dec: u8) -> u64 {
    if price == 0 {
        return 0;
    }
    let num = usdc as u128 * pow10(dec as u32) * pow10((-exp) as u32);
    let den = price as u128 * pow10(USDC_DECIMALS);
    (num / den).min(u64::MAX as u128) as u64
}

/// tUSDC (6 decimals) that `units` are worth at `price`.
pub fn usdc_for(units: u64, price: u64, exp: i32, dec: u8) -> u64 {
    let num = units as u128 * price as u128 * pow10(USDC_DECIMALS);
    let den = pow10(dec as u32) * pow10((-exp) as u32);
    (num / den).min(u64::MAX as u128) as u64
}

/// The real P&L of a closed position: a long sold `units` for `exit_usdc` after paying
/// `notional`; a short bought them back for `exit_usdc` after selling for `notional`.
pub fn real_pnl(long: bool, notional: u64, exit_usdc: u64) -> i64 {
    if long {
        exit_usdc as i64 - notional as i64
    } else {
        notional as i64 - exit_usdc as i64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn units_and_back() {
        // 25 tUSDC of TSLAx at 380.00 (raw 38_000_000, exp -5), 8 decimals: 0.06578947 TSLAx
        let u = units_for(25_000_000, 38_000_000, -5, 8);
        assert_eq!(u, 6_578_947);
        let back = usdc_for(u, 38_000_000, -5, 8);
        assert!(back <= 25_000_000 && 25_000_000 - back < 10); // rounded down: the desk never pays more
        // gold: 100 tUSDC of XAUt at 3,540.000 (raw 3_540_000, exp -3), 6 decimals
        let g = units_for(100_000_000, 3_540_000, -3, 6);
        assert_eq!(g, 28_248);
        // a 1 % rise doubles nothing: 1 % on the position
        let up = usdc_for(u, 38_380_000, -5, 8);
        assert_eq!(real_pnl(true, 25_000_000, up), up as i64 - 25_000_000);
        assert!((real_pnl(true, 25_000_000, up) - 250_000).abs() < 5);
        assert!((real_pnl(false, 25_000_000, up) + 250_000).abs() < 5);
    }

    #[test]
    fn spread_both_ways() {
        assert_eq!(ask(1_000_000, 5), 1_000_500);
        assert_eq!(bid(1_000_000, 5), 999_500);
    }
}
