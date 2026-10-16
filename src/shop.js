// Cosmetics: visor colors and trail styles, their look, and the shop screen.
import { C, panel, inkText, plainText, caption, button } from './comic.js';
import { drawGlitch } from './glitch.js';

const VISORS = [
  { id: 'green', name: 'TERMINAL', color: C.green, price: 0 },
  { id: 'yellow', name: 'SUNNY', color: C.yellow, price: 150 },
  { id: 'red', name: 'ALERT', color: C.red, price: 250 },
  { id: 'magenta', name: 'NEON', color: C.magenta, price: 400 },
  { id: 'blue', name: 'DEEP', color: C.blue, price: 550 },
  { id: 'paper', name: 'GHOST', color: C.paper, price: 800 },
];

const TRAILS = [
  { id: 'classic', name: 'BYTES', price: 0 },
  { id: 'binary', name: 'BINARY', price: 300 },
  { id: 'dots', name: 'PIXELS', price: 450 },
  { id: 'rainbow', name: 'RAINBOW', price: 650 },
  { id: 'stars', name: 'STARS', price: 900 },
  { id: 'hearts', name: 'LOVE', price: 1200 },
];

const RAINBOW = [C.red, C.yellow, C.green, C.blue, C.magenta];

export const visorColor = id => (VISORS.find(v => v.id === id) || VISORS[0]).color;
export const shopItems = tab => (tab === 'trail' ? TRAILS : VISORS);

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function heart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}

function inkShape(ctx, fill) {
  ctx.save();
  ctx.translate(2, 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

// One trail byte of size s centered at (x, y). Caller sets lineWidth and strokeStyle.
export function drawByte(ctx, style, x, y, s, i) {
  const h = s / 2;
  switch (style) {
    case 'binary':
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - h + 2, y - h + 2, s, s);
      ctx.fillStyle = C.paper;
      ctx.fillRect(x - h, y - h, s, s);
      ctx.strokeRect(x - h, y - h, s, s);
      plainText(ctx, i % 3 ? '1' : '0', x, y, s * 0.8);
      break;
    case 'dots':
      ctx.beginPath(); ctx.arc(x, y, h + 1, 0, Math.PI * 2);
      inkShape(ctx, C.blue);
      break;
    case 'stars':
      star(ctx, x, y, h + 3);
      inkShape(ctx, C.yellow);
      break;
    case 'hearts':
      heart(ctx, x, y, h + 1);
      inkShape(ctx, i % 2 ? C.red : C.magenta);
      break;
    default:
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - h + 2, y - h + 2, s, s);
      ctx.fillStyle = style === 'rainbow' ? RAINBOW[i % 5] : C.yellow;
      ctx.fillRect(x - h, y - h, s, s);
      ctx.strokeRect(x - h, y - h, s, s);
  }
}

export function drawShop(ctx, g, v, hits) {
  const p = g.profile, top = v.safeTop + 12, owned = g.shopTab === 'trail' ? p.trails : p.visors;
  const equipped = g.shopTab === 'trail' ? p.trail : p.visor;
  inkText(ctx, 'SHOP', 92, top + 28, 40, C.yellow);
  caption(ctx, `${p.coins} COINS`, 262, top + 28, 16, C.yellow, { tilt: 0.03 });

  const tabs = [['visor', 'VISOR'], ['trail', 'TRAIL']];
  tabs.forEach(([id, label], i) => {
    button(ctx, hits, 'tab:' + id, label, 96 + i * 168, top + 86, 148, 44,
      g.shopTab === id ? C.blue : C.paper, g.shopTab === id ? C.paper : C.ink);
  });

  shopItems(g.shopTab).forEach((it, i) => {
    const x = 22 + (i % 2) * 166, y = top + 124 + Math.floor(i / 2) * 116, w = 150, h = 104;
    const has = owned.includes(it.id), on = equipped === it.id;
    panel(ctx, x, y, w, h, on ? C.green : C.paper, { r: 6, shadow: 4 });
    if (g.shopTab === 'trail') {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.ink;
      for (let k = 0; k < 4; k++) drawByte(ctx, it.id, x + 36 + k * 26, y + 34, 13, k);
    } else {
      drawGlitch(ctx, x + w / 2, y + 40, { scale: 1.05, visor: it.color, t: g.time });
    }
    plainText(ctx, it.name, x + w / 2, y + 70, 13);
    plainText(ctx, on ? 'ON' : has ? 'OWNED' : `${it.price} C`, x + w / 2, y + 89, 13, has ? C.ink : C.red);
    hits.push({ id: 'item:' + it.id, x, y, w, h });
  });

  if (g.shopMsgT > g.time) caption(ctx, 'NEED MORE COINS', v.w / 2, top + 486, 16, C.red, { color: C.paper });
  button(ctx, hits, 'back', 'BACK', v.w / 2, Math.min(v.h - 40, top + 512), 160, 48, C.paper);
}
