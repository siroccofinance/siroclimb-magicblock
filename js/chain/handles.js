// Player handles: a default handle per wallet, and realistic, varied names for
// ops-created players and practice bots, so the public leaderboard reads like
// a real lobby. Deterministic per seed (a public key), unique within a list.
const A = ['dune', 'mistral', 'saffron', 'harmattan', 'oasis', 'zephyr', 'atlas', 'khamsin', 'leveche', 'simoom', 'bora', 'chinook', 'ghibli',
  'tramontane', 'foehn', 'levant', 'sahel', 'marrakech', 'tuareg', 'mirage', 'ember', 'ochre', 'amber', 'cobalt', 'onyx', 'basalt', 'copper',
  'gold', 'sterling', 'nasdaq', 'bullion', 'tesla', 'apple', 'nvidia', 'candle', 'wick', 'yield', 'carry', 'alpha', 'delta', 'vega', 'theta'];
const B = ['trader', 'climber', 'runner', 'hunter', 'rider', 'monk', 'fox', 'falcon', 'lynx', 'otter', 'wolf', 'owl', 'shark', 'bull', 'bear',
  'nomad', 'pilot', 'scout', 'smith', 'sage', 'baron', 'queen', 'king', 'hands', 'desk', 'quant', 'whale', 'gecko'];
const SUFFIX = ['', '', '', '.sol', 'x', '42', '77', '88', '_fx', '_gold', 'fi', '24', '09'];

const pick = (xs, r) => xs[Math.floor(r() * xs.length)];

export function handleFor(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), h / 2 ** 32);
  const style = Math.floor(r() * 5), a = pick(A, r), b = pick(B, r);
  const name = style === 0 ? `${a}_${b}` : style === 1 ? `${a}${b}${pick(SUFFIX, r)}` : style === 2 ? `${a}${Math.floor(r() * 990) + 10}` : style === 3 ? `${a}.sol` : `${b}${pick(SUFFIX, r)}`;
  return name.slice(0, 16);
}

export function uniqueHandles(seeds) {
  const seen = new Set();
  return seeds.map((s) => {
    let h = handleFor(s);
    for (let i = 2; seen.has(h); i++) h = `${handleFor(s).slice(0, 14)}${i}`;
    seen.add(h);
    return h;
  });
}
