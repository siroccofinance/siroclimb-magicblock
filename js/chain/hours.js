// Trading hours, from Pyth Lazer's published schedules (America/New_York).
//
// Pyth's feeds keep publishing outside a market's sessions with the last
// price frozen and a fresh timestamp (seen on gold during its daily break), so
// a fresh publish time does not mean the market is open: the lobby checks the
// schedule as well. Format: "TZ;mon,tue,wed,thu,fri,sat,sun;MMDD/day,…" where
// a day is O (open), C (closed) or HHMM-HHMM ranges joined by &.

const EQUITY = [
  'America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;0907/C,1126/C,1127/0930-1300,1224/0930-1300,1225/C,0101/C,0118/C,0215/C,0326/C,0531/C,0618/C,0705/C',
  'America/New_York;0400-0930,0400-0930,0400-0930,0400-0930,0400-0930,C,C;0907/C,1126/C,1225/C,0101/C,0118/C,0215/C,0326/C,0531/C,0618/C,0705/C',
  'America/New_York;1600-2000,1600-2000,1600-2000,1600-2000,1600-2000,C,C;0907/C,1126/C,1127/1300-1700,1224/1300-1700,1225/C,0101/C,0118/C,0215/C,0326/C,0531/C,0618/C,0705/C',
  'America/New_York;0000-0400&2000-2400,0000-0400&2000-2400,0000-0400&2000-2400,0000-0400&2000-2400,0000-0400,C,2000-2400;0906/C,0907/2000-2400,1125/0000-0400,1126/2000-2400,1224/0000-0400,1225/C,1231/0000-0400,0101/C,0117/C,0118/2000-2400,0214/C,0215/2000-2400,0325/0000-0400,0326/C,0530/C,0531/2000-2400,0617/0000-0400,0618/C,0704/C,0705/2000-2400',
];
const METAL = ['America/New_York;0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700,C,1800-2400;0907/0000-1430&1800-2400,1126/0000-1430&1800-2400,1127/0000-1445,1224/0000-1345,1225/C,1231/0000-1700,0101/C,0118/0000-1430&1800-2400,0215/0000-1430&1800-2400,0325/0000-1700,0326/C,0531/0000-1430&1800-2400,0618/0000-1300,0705/0000-1430&1800-2400'];

export const SCHEDULES = { 'us-equity': EQUITY, metal: METAL };

const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, weekday: 'short', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const DAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function nyParts(ms) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { day: DAYS[p.weekday], mmdd: p.month + p.day, hhmm: Number(p.hour === '24' ? '00' : p.hour) * 100 + Number(p.minute) };
}

function dayOpen(spec, hhmm) {
  if (spec === 'O') return true;
  if (spec === 'C') return false;
  return spec.split('&').some((r) => { const [a, b] = r.split('-').map(Number); return hhmm >= a && hhmm < b; });
}

export function scheduleOpen(schedule, ms = Date.now()) {
  const [, week, overrides = ''] = schedule.split(';');
  const t = nyParts(ms);
  const special = overrides.split(',').map((o) => o.split('/')).find(([d]) => d === t.mmdd);
  return dayOpen(special ? special[1] : week.split(',')[t.day], t.hhmm);
}

/// Is a market (by its `hours` tag) inside one of its sessions? Unknown tags
/// count as open.
export function inSession(hours, ms = Date.now()) {
  const s = SCHEDULES[hours];
  return !s || s.some((x) => scheduleOpen(x, ms));
}

/// When a closed market opens next (ms), scanning ahead minute by minute up to a week.
export function nextOpen(hours, ms = Date.now()) {
  if (!SCHEDULES[hours]) return null;
  let t = Math.ceil(ms / 60000) * 60000;
  for (let i = 0; i < 7 * 24 * 60; i += 5, t += 5 * 60000) if (inSession(hours, t)) return t;
  return null;
}
