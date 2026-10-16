// Snake tail: a ring buffer of head positions; bytes sit at fixed path distances behind the head.
const SEG = 2;       // min distance between recorded points
const SPACING = 11;  // path distance between bytes
const CAP = 4096;    // recorded points
const MAX_OUT = 512; // bytes laid out per frame (only on-screen ones are needed)

export class Trail {
  constructor() {
    this.xs = new Float32Array(CAP);
    this.ys = new Float32Array(CAP);
    this.out = new Float32Array(MAX_OUT * 2);
  }

  reset(x, y) {
    this.n = 0;
    this.head = -1;
    for (let i = 300; i >= 0; i--) this.add(x, y - i * SEG);
  }

  add(x, y) {
    this.head = (this.head + 1) % CAP;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.n = Math.min(this.n + 1, CAP);
  }

  push(x, y) {
    if (Math.hypot(x - this.xs[this.head], y - this.ys[this.head]) >= SEG) this.add(x, y);
  }

  // Writes up to `count` byte positions into this.out, stopping past maxDist. Returns how many.
  layout(hx, hy, count, maxDist) {
    const { xs, ys, out } = this;
    const limit = Math.min(count, MAX_OUT);
    let px = hx, py = hy, acc = 0, target = SPACING, k = 0, idx = this.head;
    for (let s = 0; s < this.n && k < limit && target <= maxDist; s++) {
      const qx = xs[idx], qy = ys[idx];
      const len = Math.hypot(qx - px, qy - py);
      while (len > 0 && acc + len >= target && k < limit && target <= maxDist) {
        const t = (target - acc) / len;
        out[2 * k] = px + (qx - px) * t;
        out[2 * k + 1] = py + (qy - py) * t;
        k++;
        target += SPACING;
      }
      acc += len;
      px = qx; py = qy;
      idx = (idx - 1 + CAP) % CAP;
    }
    // History ran out: continue straight down.
    for (; k < limit && target <= maxDist; k++, target += SPACING) {
      out[2 * k] = px;
      out[2 * k + 1] = py - (target - acc);
    }
    return k;
  }
}
