// Deterministic level generator: same level number, same level.
import { applyOp, SNAKE_V } from './entities.js';

// World geometry: 5 lanes of 64 units, 20-unit curbs each side.
export const TRACK = { l: 20, r: 340, cx: 180, lane: 64 };
export const WALL_H = 120;   // firewall height above level.length
export const STEPS_AT = 140; // bonus steps start this far past level.length
export const STEP_GAP = 64;  // height of one bonus step

function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));

function goodOp(r, d) {
  if (r() < 0.3 + 0.1 * d) return { op: 'x', v: r() < 0.2 * d ? 3 : 2 };
  return { op: '+', v: int(r, 3 + Math.round(5 * d), 8 + Math.round(12 * d)) };
}

function badOp(r, d) {
  if (r() < 0.35) return { op: '/', v: r() < 0.3 * d ? 3 : 2 };
  return { op: '-', v: int(r, 2 + Math.round(4 * d), 5 + Math.round(10 * d)) };
}

function gatePair(r, d, hi) {
  const k = r();
  let a, b;
  if (k < 0.55 - 0.25 * d) { a = goodOp(r, d); b = badOp(r, d); }
  else if (k < 0.85 - 0.1 * d) { a = goodOp(r, d); b = goodOp(r, d); }
  else { a = badOp(r, d); b = badOp(r, d); }
  // Keep the tail in a sane range: big multipliers turn into adds.
  for (const o of [a, b]) {
    if (o.op === 'x' && hi * o.v > 240) Object.assign(o, { op: '+', v: int(r, 4, 10 + Math.round(10 * d)) });
  }
  if (a.op === b.op && a.v === b.v) b.v += a.op === '+' || a.op === '-' ? 2 : 1;
  return r() < 0.5 ? [a, b] : [b, a];
}

// Snakes crawl down; spawn them where they will meet Glitch at meetY.
function snake(r, meetY, speed, len, side) {
  const amp = int(r, 16, 50);
  const half = (TRACK.r - TRACK.l) / 2;
  const lo = TRACK.l + 30 + amp + (side > 0 ? half : 0);
  const hi = lo + half - 60 - 2 * amp;
  return {
    y0: meetY * (speed + SNAKE_V) / speed,
    x0: side ? int(r, lo, Math.max(lo, hi)) : int(r, TRACK.l + 40 + amp, TRACK.r - 40 - amp),
    len, amp, freq: 1.2 + r() * 1.3, phase: r() * 6.28,
  };
}

export function buildLevel(n) {
  const r = rng(Math.imul(n, 2654435761));
  const d = Math.min(1, (n - 1) / 29);
  const speed = 230 + 50 * d;
  const length = speed * (26 + 13 * d + 2 * r());
  const startBytes = 5;
  const gates = [], snakes = [], scanners = [];
  // lo/hi = worst and best reachable tail. Every effect is monotone, so greedy per step is exact.
  let lo = startBytes, hi = startBytes;
  const meetSnake = len => {
    hi = hi > len ? hi + len : hi;
    lo = lo > len ? lo : Math.max(0, lo - len);
  };

  for (let y = 520; y < length - 450;) {
    const [a, b] = gatePair(r, d, hi);
    gates.push({ y, left: a, right: b, hit: null });
    lo = Math.min(applyOp(lo, a), applyOp(lo, b));
    hi = Math.max(applyOp(hi, a), applyOp(hi, b));

    const gap = speed * (2.1 + 0.7 * r()) * (1 - 0.15 * d);
    const hy = y + gap / 2;
    if (hy < length - 450 && r() < 0.45 + 0.45 * d) {
      // Small snakes are edible for a decent run; big ones beat even the best possible tail.
      const small = () => Math.max(2, Math.min(Math.round(hi * 0.4), int(r, 3 + Math.round(6 * d), 8 + Math.round(22 * d))));
      const big = () => Math.round(hi * (1.1 + 0.5 * r())) + 3;
      if (n >= 3 && r() < 0.3 + 0.2 * d) {
        scanners.push({ y: hy, side: r() < 0.5 ? -1 : 1, freq: 1 + 0.9 * d + 0.3 * r(), phase: r() * 6.28 });
      } else if (r() < 0.35 * d) {
        // Twin snakes: one edible, one not, on opposite halves.
        const side = r() < 0.5 ? -1 : 1, s1 = small(), s2 = big();
        snakes.push(snake(r, hy, speed, s1, side), snake(r, hy, speed, s2, -side));
        meetSnake(s1);
      } else {
        const len = r() < 0.6 - 0.2 * d ? small() : big();
        snakes.push(snake(r, hy, speed, len, 0));
        meetSnake(len);
      }
    }
    y += gap;
  }

  const f = 0.3 + 0.25 * d;
  return { n, speed, length, startBytes, gates, snakes, scanners, bossHp: Math.max(5, Math.round(lo + (hi - lo) * f)) };
}
