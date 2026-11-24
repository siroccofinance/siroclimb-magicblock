// Writes chain/programs/siroclimb/tests/hours-fixture.txt: 3,000 instants over
// a year with the session mask the front computes, so the program's own
// schedule (hours.rs) is tested against exactly the same answers.
import fs from 'fs';
import { inSession } from '../../js/chain/hours.js';
import { MARKETS } from '../../js/chain/config.js';

let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const start = Date.parse('2026-01-01T00:00:00Z') / 1000, span = 366 * 86400;
const lines = [];
for (let i = 0; i < 3000; i++) {
  // half uniformly, half on minute boundaries near session edges
  const ts = i % 2 ? Math.floor(start + rnd() * span) : Math.floor((start + rnd() * span) / 1800) * 1800 + [-60, 0, 60][i % 3];
  const mask = MARKETS.reduce((m, mk, a) => (inSession(mk.hours, ts * 1000) ? m | (1 << a) : m), 0);
  lines.push(`${ts} ${mask}`);
}
fs.writeFileSync(new URL('../../chain/programs/siroclimb/tests/hours-fixture.txt', import.meta.url), lines.join('\n') + '\n');
console.log('fixture:', lines.length, 'instants');
