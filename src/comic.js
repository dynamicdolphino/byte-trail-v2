// Comic drawing kit: palette, ink outlines, halftone, lettering, captions, bursts, buttons.
export const C = {
  paper: '#FFF8E7', ink: '#111111', red: '#FF3B30', yellow: '#FFD60A',
  blue: '#1E6BFF', green: '#34C759', magenta: '#FF2D95',
};
export const INK_W = 3.5;
const FONT = '"Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif';
const PATTERN_RES = 4;
const patterns = new Map();

function font(size) { return `900 ${size}px ${FONT}`; }

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 45-degree halftone dot pattern, anchored at (ox, oy) so dots travel with their object.
export function halftone(ctx, color, step, r, ox = 0, oy = 0) {
  const key = color + step + '/' + r;
  let p = patterns.get(key);
  if (!p) {
    const s = step * PATTERN_RES, c = document.createElement('canvas');
    c.width = c.height = s;
    const x = c.getContext('2d');
    x.fillStyle = color;
    for (const [dx, dy] of [[0, 0], [s, 0], [0, s], [s, s], [s / 2, s / 2]]) {
      x.beginPath(); x.arc(dx, dy, r * PATTERN_RES, 0, Math.PI * 2); x.fill();
    }
    p = ctx.createPattern(c, 'repeat');
    patterns.set(key, p);
  }
  p.setTransform(new DOMMatrix([1 / PATTERN_RES, 0, 0, 1 / PATTERN_RES, ox, oy]));
  return p;
}

// Flat fill, ink outline, ink hard shadow. `tone` adds halftone shading on the lower part,
// `dots` adds a Ben-Day pattern over the whole fill.
export function panel(ctx, x, y, w, h, fill, { r = 6, shadow = 4, lw = INK_W, tone = false, dots = null } = {}) {
  if (shadow) {
    ctx.fillStyle = C.ink;
    rr(ctx, x + shadow, y + shadow, w, h, r);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  if (dots) { ctx.fillStyle = halftone(ctx, dots, 6, 1.3, x, y); ctx.fill(); }
  if (tone) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = halftone(ctx, C.ink, 4, 0.9, x, y);
    ctx.fillRect(x, y + h * 0.62, w, h * 0.38);
    ctx.restore();
    rr(ctx, x, y, w, h, r);
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

export function disc(ctx, x, y, r, fill, shadow = 3) {
  if (shadow) {
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(x + shadow, y + shadow, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = INK_W;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

// Slanted bold lettering with ink outline and a hard ink shadow.
export function inkText(ctx, text, x, y, size, fill, { align = 'center', skew = -0.18 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, skew, 1, 0, 0);
  ctx.font = font(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = C.ink;
  const o = Math.max(2, size * 0.07);
  ctx.strokeText(text, o, o);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function plainText(ctx, text, x, y, size, color = C.ink, align = 'center') {
  ctx.font = font(size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + size * 0.06);
}

// Comic caption box: tilted panel with plain lettering.
export function caption(ctx, text, x, y, size, fill, { tilt = -0.04, color = C.ink } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.font = font(size);
  const w = ctx.measureText(text).width + size * 0.9, h = size * 1.4;
  panel(ctx, -w / 2, -h / 2, w, h, fill, { r: 4, shadow: 3 });
  plainText(ctx, text, 0, 0, size, color);
  ctx.restore();
}

// Jagged speech-burst with slanted lettering. k in 0..1 is the pop-in scale.
export function burst(ctx, text, x, y, size, fill, textFill, seed, k = 1) {
  const spikes = 11, outer = size * 1.25 + text.length * size * 0.18;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.rotate(((seed * 7) % 5 - 2) * 0.05);
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const jag = 1 + 0.18 * Math.sin(seed * 13 + i * 2.7);
    const rad = (i % 2 ? outer * 0.68 : outer * jag);
    ctx.lineTo(Math.cos(a) * rad * 1.25, Math.sin(a) * rad * 0.8);
  }
  ctx.closePath();
  ctx.save();
  ctx.translate(4, 4);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = INK_W;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  inkText(ctx, text, 0, 0, size, textFill);
  ctx.restore();
}

// Chunky button; registers its hit box (logical units) in `hits`.
export function button(ctx, hits, id, label, cx, cy, w, h, fill, color = C.ink, size = 18) {
  panel(ctx, cx - w / 2, cy - h / 2, w, h, fill, { r: 8, shadow: 5, lw: 4 });
  plainText(ctx, label, cx, cy, size, color);
  hits.push({ id, x: cx - w / 2, y: cy - h / 2, w, h });
}
