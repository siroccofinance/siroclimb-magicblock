//! Trading sessions on chain, so a closed market's frozen price cannot start
//! a climb. Pyth keeps publishing outside a market's sessions with the last
//! price and a fresh timestamp, so freshness alone is not enough.
//!
//! Mirrors Pyth Lazer's published schedules (New York time), the same ones the
//! front reads (js/chain/hours.js): US equities run from Sunday 20:00 to Friday
//! 20:00 across their overnight, pre-market, regular and post-market sessions;
//! gold from Sunday 18:00 to Friday 17:00 with a daily hour off at 17:00. The
//! holiday overrides are the union of each session's overrides.

pub const KIND_EQUITY: u8 = 0;
pub const KIND_METAL: u8 = 1;
/// Around the clock: the xStocks and XAUt (gold) trade 24/7 on chain, and
/// their prices (the relay's) move all week.
pub const KIND_ALWAYS: u8 = 2;

/// Session kind per asset: TSLAx, NVDAx, AAPLx, gold (XAUt), GMEx.
/// Every market is open all week; the equity and metal schedules are kept (and
/// tested) for a market that would follow them.
pub const KINDS: [u8; 5] = [KIND_ALWAYS, KIND_ALWAYS, KIND_ALWAYS, KIND_ALWAYS, KIND_ALWAYS];

const M: u16 = 60;
const DAY: u16 = 24 * M;
type Ranges = &'static [(u16, u16)];

const EQ_WEEKDAY: Ranges = &[(0, DAY)];
const EQ_FRIDAY: Ranges = &[(0, 20 * M)];
const EQ_SUNDAY: Ranges = &[(20 * M, DAY)];
const CLOSED: Ranges = &[];
/// Mon..Sun.
const EQ_WEEK: [Ranges; 7] = [EQ_WEEKDAY, EQ_WEEKDAY, EQ_WEEKDAY, EQ_WEEKDAY, EQ_FRIDAY, CLOSED, EQ_SUNDAY];
const EQ_HOLIDAYS: &[(u16, Ranges)] = &[
    (906, CLOSED),
    (907, &[(20 * M, DAY)]),
    (1125, &[(0, 20 * M)]),
    (1126, &[(20 * M, DAY)]),
    (1127, &[(0, 17 * M)]),
    (1224, &[(0, 17 * M)]),
    (1225, CLOSED),
    (1231, &[(0, 20 * M)]),
    (101, CLOSED),
    (117, CLOSED),
    (118, &[(20 * M, DAY)]),
    (214, CLOSED),
    (215, &[(20 * M, DAY)]),
    (325, &[(0, 20 * M)]),
    (326, CLOSED),
    (530, CLOSED),
    (531, &[(20 * M, DAY)]),
    (617, &[(0, 20 * M)]),
    (618, CLOSED),
    (704, CLOSED),
    (705, &[(20 * M, DAY)]),
];

const MT_WEEKDAY: Ranges = &[(0, 17 * M), (18 * M, DAY)];
const MT_WEEK: [Ranges; 7] = [MT_WEEKDAY, MT_WEEKDAY, MT_WEEKDAY, MT_WEEKDAY, &[(0, 17 * M)], CLOSED, &[(18 * M, DAY)]];
const MT_SHORT: Ranges = &[(0, 14 * M + 30), (18 * M, DAY)];
const MT_HOLIDAYS: &[(u16, Ranges)] = &[
    (907, MT_SHORT),
    (1126, MT_SHORT),
    (1127, &[(0, 14 * M + 45)]),
    (1224, &[(0, 13 * M + 45)]),
    (1225, CLOSED),
    (1231, &[(0, 17 * M)]),
    (101, CLOSED),
    (118, MT_SHORT),
    (215, MT_SHORT),
    (325, &[(0, 17 * M)]),
    (326, CLOSED),
    (531, MT_SHORT),
    (618, &[(0, 13 * M)]),
    (705, MT_SHORT),
];

/// Civil date (y, m, d) from days since 1970-01-01 (H. Hinnant's algorithm).
fn civil(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (yoe + era * 400 + if m <= 2 { 1 } else { 0 }, m, d)
}

fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m as i64 + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// Day of the n-th Sunday (1-based) of a month, as days since the epoch.
fn nth_sunday(y: i64, m: u32, n: i64) -> i64 {
    let first = days_from_civil(y, m, 1);
    let wd = (first + 3).rem_euclid(7); // Mon = 0
    first + (6 - wd) + 7 * (n - 1)
}

/// New York's UTC offset in seconds at `ts`: daylight time from the second
/// Sunday of March 02:00 to the first Sunday of November 02:00.
pub fn ny_offset(ts: i64) -> i64 {
    let (y, _, _) = civil(ts.div_euclid(86_400));
    let start = nth_sunday(y, 3, 2) * 86_400 + 7 * 3600; // 02:00 EST
    let end = nth_sunday(y, 11, 1) * 86_400 + 6 * 3600; // 02:00 EDT
    if ts >= start && ts < end {
        -4 * 3600
    } else {
        -5 * 3600
    }
}

fn open_in(week: &[Ranges; 7], holidays: &[(u16, Ranges)], ts: i64) -> bool {
    let local = ts + ny_offset(ts);
    let days = local.div_euclid(86_400);
    let minute = (local.rem_euclid(86_400) / 60) as u16;
    let (_, m, d) = civil(days);
    let mmdd = (m * 100 + d) as u16;
    let ranges = holidays.iter().find(|(k, _)| *k == mmdd).map(|(_, r)| *r).unwrap_or(week[(days + 3).rem_euclid(7) as usize]);
    ranges.iter().any(|(a, b)| minute >= *a && minute < *b)
}

/// Is `asset` inside one of its trading sessions at unix time `ts`?
pub fn in_session(asset: u8, ts: i64) -> bool {
    match KINDS.get(asset as usize) {
        Some(&KIND_EQUITY) => open_in(&EQ_WEEK, EQ_HOLIDAYS, ts),
        Some(&KIND_METAL) => open_in(&MT_WEEK, MT_HOLIDAYS, ts),
        Some(&KIND_ALWAYS) => true,
        _ => false,
    }
}

/// Bit mask of the assets in session at `ts`.
pub fn session_mask(ts: i64) -> u8 {
    (0..KINDS.len() as u8).filter(|a| in_session(*a, ts)).fold(0, |m, a| m | (1 << a))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(y: i64, m: u32, d: u32, h: i64, min: i64) -> i64 {
        days_from_civil(y, m, d) * 86_400 + h * 3600 + min * 60
    }

    #[test]
    fn calendar_and_daylight_time() {
        assert_eq!(civil(0), (1970, 1, 1));
        assert_eq!(days_from_civil(2026, 11, 23), 20_780);
        assert_eq!(ny_offset(utc(2026, 7, 1, 12, 0)), -4 * 3600);
        assert_eq!(ny_offset(utc(2026, 11, 23, 12, 0)), -5 * 3600);
        // 2026: DST from 8 March 07:00 UTC to 1 November 06:00 UTC
        assert_eq!(ny_offset(utc(2026, 3, 8, 6, 59)), -5 * 3600);
        assert_eq!(ny_offset(utc(2026, 3, 8, 7, 0)), -4 * 3600);
        assert_eq!(ny_offset(utc(2026, 11, 1, 5, 59)), -4 * 3600);
        assert_eq!(ny_offset(utc(2026, 11, 1, 6, 0)), -5 * 3600);
    }

    /// The US equity sessions (kept for a market that would follow them).
    fn eq(ts: i64) -> bool {
        open_in(&EQ_WEEK, EQ_HOLIDAYS, ts)
    }
    /// Gold's spot sessions (kept for a market that would follow them).
    fn metal(ts: i64) -> bool {
        open_in(&MT_WEEK, MT_HOLIDAYS, ts)
    }

    #[test]
    fn equities_sunday_evening_to_friday_evening() {
        // Mon 23 Nov 2026, 10:00 New York = 15:00 UTC
        assert!(eq(utc(2026, 11, 23, 15, 0)));
        // Fri 20 Nov 19:59 NY open, 20:00 closed
        assert!(eq(utc(2026, 11, 21, 0, 59)));
        assert!(!eq(utc(2026, 11, 21, 1, 0)));
        // Saturday closed, Sunday 20:00 NY opens
        assert!(!eq(utc(2026, 11, 28, 15, 0)));
        assert!(!eq(utc(2026, 11, 30, 0, 59)));
        assert!(eq(utc(2026, 11, 30, 1, 0)));
    }

    #[test]
    fn thanksgiving() {
        // Wed 25 Nov: open until 20:00 NY, then closed overnight
        assert!(eq(utc(2026, 11, 26, 0, 59)));
        assert!(!eq(utc(2026, 11, 26, 1, 0)));
        // Thu 26 Nov: closed until 20:00 NY
        assert!(!eq(utc(2026, 11, 26, 17, 0)));
        assert!(eq(utc(2026, 11, 27, 1, 0)));
        // Fri 27 Nov: until 17:00 NY
        assert!(eq(utc(2026, 11, 27, 21, 59)));
        assert!(!eq(utc(2026, 11, 27, 22, 0)));
        // gold: 26 Nov closes 14:30 to 18:00, 27 Nov closes at 14:45
        assert!(!metal(utc(2026, 11, 26, 20, 0)));
        assert!(metal(utc(2026, 11, 26, 23, 0)));
        assert!(!metal(utc(2026, 11, 27, 19, 46)));
    }

    #[test]
    fn gold_daily_break_and_weekend() {
        assert!(metal(utc(2026, 11, 23, 21, 59)));
        assert!(!metal(utc(2026, 11, 23, 22, 30)));
        assert!(metal(utc(2026, 11, 23, 23, 0)));
        assert!(!metal(utc(2026, 11, 28, 12, 0)));
        assert!(metal(utc(2026, 11, 29, 23, 0)));
    }

    #[test]
    fn every_market_trades_around_the_clock() {
        // Saturday, Thanksgiving, gold's daily break: all five open
        for ts in [utc(2026, 11, 28, 12, 0), utc(2026, 11, 26, 17, 0), utc(2026, 11, 23, 22, 30), utc(2026, 11, 29, 3, 0)] {
            assert_eq!(session_mask(ts), 0b11111, "at {}", ts);
        }
        assert!(in_session(3, utc(2026, 11, 28, 12, 0)));
        assert!(!in_session(9, 0));
    }

    /// The same answers as the front's schedule reader (js/chain/hours.js) on
    /// 3,000 instants over a year, fixture generated by ops/test/hours-fixture.mjs.
    #[test]
    fn matches_the_front() {
        let fixture = include_str!("../tests/hours-fixture.txt");
        let mut n = 0;
        for line in fixture.lines() {
            let mut it = line.split_whitespace();
            let ts: i64 = it.next().unwrap().parse().unwrap();
            let mask: u8 = it.next().unwrap().parse().unwrap();
            assert_eq!(session_mask(ts), mask, "at {}", ts);
            n += 1;
        }
        assert!(n >= 3000);
    }
}
