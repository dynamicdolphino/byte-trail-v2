// Gate ops, bug-snake motion and hits, scanner cones. Pure functions of level time.
const LABEL = { '+': '+', '-': '-', 'x': '×', '/': '÷' };

export const SNAKE_V = 45;     // snakes crawl down at this speed
const SNAKE_SEG = 15;   // body spacing
export const SNAKE_SHOWN = 10; // body segments drawn and hit-tested
export const CONE_R = 300;
export const CONE_HALF = 0.26;
const SWEEP = 0.6;

export function applyOp(n, { op, v }) {
  switch (op) {
    case '+': return n + v;
    case '-': return Math.max(0, n - v);
    case 'x': return n * v;
    default: return Math.floor(n / v);
  }
}

export const opLabel = ({ op, v }) => LABEL[op] + v;
export const opGood = ({ op }) => op === '+' || op === 'x';

// Point i of a snake at level time t: 0 is the head, body trails upward.
export function snakePoint(s, t, i) {
  return [
    s.x0 + s.amp * Math.sin(s.freq * t + s.phase - i * 0.55),
    s.y0 - SNAKE_V * t + i * SNAKE_SEG,
  ];
}

export function snakeHits(s, t, x, y, r) {
  const shown = Math.min(s.len, SNAKE_SHOWN);
  for (let i = 0; i <= shown; i++) {
    const [px, py] = snakePoint(s, t, i);
    if (Math.hypot(px - x, py - y) < r + (i ? 8 : 13)) return true;
  }
  return false;
}

// Scanners sit on a track edge (side -1 left, 1 right) and sweep a cone across the track.
export function scannerAngle(sc, t) {
  return (sc.side < 0 ? 0 : Math.PI) + SWEEP * Math.sin(sc.freq * t + sc.phase);
}

export function inCone(sc, sx, t, x, y) {
  const dx = x - sx, dy = y - sc.y;
  if (Math.hypot(dx, dy) > CONE_R) return false;
  let a = Math.atan2(dy, dx) - scannerAngle(sc, t);
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(a) < CONE_HALF;
}
