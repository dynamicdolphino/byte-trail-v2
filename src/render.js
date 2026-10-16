// Frame rendering: track, hazards, firewall, bonus steps, trail, Glitch, effects, HUD and screens.
import { C, INK_W, rr, panel, disc, inkText, plainText, caption, burst, button, halftone } from './comic.js';
import { TRACK, WALL_H, STEPS_AT, STEP_GAP } from './level.js';
import { opLabel, snakePoint, scannerAngle, CONE_R, CONE_HALF, SNAKE_SHOWN } from './entities.js';
import { drawGlitch } from './glitch.js';
import { drawByte, drawShop, visorColor } from './shop.js';
import { hasAds } from './platform.js';

const ANCHOR = 0.7; // Glitch sits at 70% of the screen height
const CURB = 40;
const OP_FILL = { '+': C.blue, 'x': C.green, '-': C.red, '/': C.magenta };
const STEP_FILL = [C.yellow, C.blue, C.green, C.magenta, C.red];
const FX = {
  good: [C.blue, C.paper], bad: [C.red, C.paper], pow: [C.yellow, C.red], ouch: [C.magenta, C.paper],
  zap: [C.blue, C.yellow], boom: [C.red, C.yellow], coin: [C.yellow, C.green],
};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Buttons drawn this frame, read by the game to resolve taps.
export const hits = [];

export function render(ctx, g, v) {
  hits.length = 0;
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, v.cssW, v.cssH);
  const k = v.dpr * v.scale;
  ctx.setTransform(k, 0, 0, k, v.dpr * v.offX, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (v.offX > 0) {
    ctx.fillStyle = halftone(ctx, C.blue, 9, 1.6);
    ctx.fillRect(-v.offX / v.scale, 0, v.offX / v.scale, v.h);
    ctx.fillRect(v.w, 0, v.offX / v.scale, v.h);
  }

  if (g.state === 'shop') {
    drawTrack(ctx, v, 0);
    return drawShop(ctx, g, v, hits);
  }

  const anchor = v.h * ANCHOR;
  const base = anchor + g.glitch.y; // screen y = base - world y
  if (g.state === 'title') {
    drawTrack(ctx, v, base);
    return drawTitle(ctx, g, v);
  }
  ctx.save();
  if (g.shake > 0.3 && !REDUCED) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

  drawTrack(ctx, v, base);
  if (g.state === 'run' && !REDUCED) drawSpeedLines(ctx, v, g.time);
  drawSteps(ctx, g, base, v.h);
  for (const gate of g.level.gates) {
    const y = base - gate.y;
    if (y > -40 && y < v.h + 40) drawGate(ctx, gate, y);
  }
  for (const sc of g.level.scanners) {
    const y = base - sc.y;
    if (y > -CONE_R && y < v.h + CONE_R) drawScanner(ctx, g, sc, y);
  }
  if (g.hp > 0) drawWall(ctx, g, base - g.level.length, v.h);
  for (const s of g.snakes) if (s.alive) drawSnake(ctx, g, s, base, v.h);

  drawTrail(ctx, g, v, anchor);
  drawShots(ctx, g, anchor, base - g.level.length);
  drawGlitch(ctx, g.glitch.x, anchor, { tilt: g.glitch.tilt, t: g.time, visor: visorColor(g.profile.visor), face: g.face });
  caption(ctx, String(g.bytes), g.glitch.x, anchor - 52, 16, C.yellow);
  ctx.restore();

  drawHud(ctx, g, v);
  if (g.state === 'run' && g.stateT < 1.4) {
    caption(ctx, `LEVEL ${g.level.n}`, v.w / 2, v.h * 0.32, 26, C.yellow);
    if (g.stateT > 0.5) inkText(ctx, 'GO!', v.w / 2, v.h * 0.32 + 50, 40, C.red);
  }
  drawFx(ctx, g, base);
  if (g.state === 'clear') drawClear(ctx, g, v);
  if (g.state === 'fail') drawFail(ctx, g, v);
}

function drawTrack(ctx, v, base) {
  // Paper track with a light halftone, shaded edges, scrolling curbs.
  ctx.fillStyle = halftone(ctx, C.yellow, 12, 1.8, 0, base % 12);
  ctx.fillRect(TRACK.l, 0, TRACK.r - TRACK.l, v.h);
  ctx.fillStyle = halftone(ctx, C.ink, 5, 1, 0, base % 5);
  ctx.fillRect(TRACK.l, 0, 10, v.h);
  ctx.fillRect(TRACK.r - 10, 0, 10, v.h);
  const first = Math.floor((base - v.h) / CURB) * CURB;
  for (let wy = first; wy < base + CURB; wy += CURB) {
    ctx.fillStyle = Math.round(wy / CURB) % 2 ? C.red : C.yellow;
    const y = base - wy - CURB;
    ctx.fillRect(0, y, TRACK.l, CURB);
    ctx.fillRect(TRACK.r, y, v.w - TRACK.r, CURB);
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 22]);
  ctx.lineDashOffset = -(base % 36);
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const x = TRACK.l + TRACK.lane * i;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, v.h);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = INK_W;
  ctx.beginPath();
  for (const x of [0, TRACK.l, TRACK.r, v.w]) { ctx.moveTo(x, 0); ctx.lineTo(x, v.h); }
  ctx.stroke();
}

// Action lines streaking down the track while running.
function drawSpeedLines(ctx, v, t) {
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const x = TRACK.l + 14 + ((i * 113) % 292);
    const len = 50 + (i % 3) * 25;
    const y = ((t * (900 + (i % 4) * 160) + i * 211) % (v.h + 200)) - 100;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
  }
  ctx.stroke();
}

function drawGate(ctx, gate, y) {
  const w = (TRACK.r - TRACK.l) / 2;
  gateHalf(ctx, TRACK.l + 6, y, w - 12, gate.left, gate.hit === gate.left);
  gateHalf(ctx, TRACK.cx + 6, y, w - 12, gate.right, gate.hit === gate.right);
  for (const x of [TRACK.l, TRACK.cx, TRACK.r]) panel(ctx, x - 4, y - 24, 8, 48, C.ink, { r: 3, shadow: 0, lw: 2 });
}

function gateHalf(ctx, x, y, w, o, chosen) {
  panel(ctx, x, y - 17, w, 34, chosen ? C.yellow : OP_FILL[o.op], { r: 6, shadow: 4, dots: C.paper });
  inkText(ctx, opLabel(o), x + w / 2, y + 1, 24, C.paper);
}

function drawScanner(ctx, g, sc, y) {
  const x = sc.side < 0 ? TRACK.l : TRACK.r, a = -scannerAngle(sc, g.t);
  const hot = g.inCone && Math.abs(sc.y - g.glitch.y) < CONE_R;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, CONE_R, a - CONE_HALF, a + CONE_HALF);
  ctx.closePath();
  ctx.fillStyle = halftone(ctx, hot ? C.red : C.yellow, 7, 2.3, x, y);
  ctx.fill();
  ctx.setLineDash([9, 7]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.setLineDash([]);
  panel(ctx, x - 13, y - 15, 26, 30, C.blue, { r: 5, shadow: 3, tone: true });
  disc(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 6, C.red, 0);
}

function drawSnake(ctx, g, s, base, vh) {
  const [hx, hw] = snakePoint(s, g.t, 0), hy = base - hw;
  if (hy < -200 || hy > vh + 40) return;
  for (let i = Math.min(s.len, SNAKE_SHOWN); i >= 1; i--) {
    const [x, wy] = snakePoint(s, g.t, i);
    panel(ctx, x - 8, base - wy - 8, 16, 16, i % 2 ? C.red : C.magenta, { r: 5, shadow: 3, lw: 3 });
  }
  // Head faces down toward Glitch
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx - 5, hy + 9); ctx.lineTo(hx - 12, hy + 21);
  ctx.moveTo(hx + 5, hy + 9); ctx.lineTo(hx + 12, hy + 21);
  ctx.stroke();
  disc(ctx, hx, hy, 13, C.magenta, 3);
  for (const ex of [-5, 5]) {
    ctx.fillStyle = C.paper;
    ctx.beginPath(); ctx.arc(hx + ex, hy + 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(hx + ex, hy + 4, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(hx - 9, hy - 5); ctx.lineTo(hx - 2, hy - 2);
  ctx.moveTo(hx + 9, hy - 5); ctx.lineTo(hx + 2, hy - 2);
  ctx.stroke();
  const edible = g.bytes > s.len;
  caption(ctx, String(s.len), hx, hy - 26, 13, edible ? C.green : C.red, { color: C.paper });
}

function drawWall(ctx, g, y, vh) {
  if (y < -10 || y - WALL_H > vh) return;
  const jitter = g.state === 'boss' ? Math.sin(g.time * 70) * 1.5 : 0;
  const x = TRACK.l - 8 + jitter, w = TRACK.r - TRACK.l + 16, top = y - WALL_H;
  panel(ctx, x, top, w, WALL_H, C.red, { r: 4, shadow: 5, tone: true });
  ctx.save();
  rr(ctx, x, top, w, WALL_H, 4);
  ctx.clip();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let row = 0; row * 24 < WALL_H; row++) {
    const ry = top + row * 24;
    ctx.moveTo(x, ry); ctx.lineTo(x + w, ry);
    for (let bx = x + (row % 2) * 24; bx < x + w; bx += 48) { ctx.moveTo(bx, ry); ctx.lineTo(bx, ry + 24); }
  }
  ctx.stroke();
  ctx.restore();
  inkText(ctx, 'FIREWALL', TRACK.cx, top + 34, 30, C.yellow);
  caption(ctx, `HP ${g.hp}`, TRACK.cx, top + 82, 22, C.paper, { tilt: 0.03 });
}

function drawSteps(ctx, g, base, vh) {
  for (let k = 1; k <= 5; k++) {
    const bottom = base - (g.level.length + STEPS_AT + (k - 1) * STEP_GAP);
    if (bottom < 0 || bottom - STEP_GAP > vh) continue;
    panel(ctx, TRACK.l + 4, bottom - STEP_GAP + 4, TRACK.r - TRACK.l - 8, STEP_GAP - 8, STEP_FILL[k - 1],
      { r: 6, shadow: 4, dots: C.paper });
    inkText(ctx, `×${k}`, TRACK.cx, bottom - STEP_GAP / 2, 30, g.climbed >= k ? C.yellow : C.paper);
  }
}

function drawTrail(ctx, g, v, anchor) {
  const n = g.trail.layout(g.glitch.x, g.glitch.y, g.bytes, v.h - anchor + 20);
  const out = g.trail.out, base = anchor + g.glitch.y, style = g.profile.trail;
  const s = 9 + Math.min(5, Math.log2(1 + g.bytes) * 0.8);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  for (let i = n - 1; i >= 0; i--) drawByte(ctx, style, out[2 * i], base - out[2 * i + 1], s, i);
}

function drawShots(ctx, g, anchor, wallY) {
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  for (const [i, s] of g.shots.entries()) {
    const x = g.glitch.x + (s.x - g.glitch.x) * s.t;
    const y = anchor - 10 + (wallY - anchor + 10) * s.t - Math.sin(Math.PI * s.t) * 24;
    drawByte(ctx, g.profile.trail, x, y, 10, i);
  }
}

function drawFx(ctx, g, base) {
  for (const f of g.fx) {
    const [fill, text] = FX[f.style];
    const y = base - f.y - f.t * 40;
    if (f.kind === 'cap') { caption(ctx, f.text, f.x, y, 18, fill, { color: text, tilt: -0.08 }); continue; }
    let k = Math.min(1.15, 0.4 + f.t * 8);
    if (f.life - f.t < 0.12) k *= (f.life - f.t) / 0.12;
    burst(ctx, f.text, Math.max(70, Math.min(290, f.x)), y, 22, fill, text, f.seed, k);
  }
}

function muteButton(ctx, g, x, y) {
  panel(ctx, x - 18, y - 16, 36, 32, C.paper, { r: 6, shadow: 3, lw: 3 });
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 4); ctx.lineTo(x - 5, y - 4); ctx.lineTo(x + 2, y - 10);
  ctx.lineTo(x + 2, y + 10); ctx.lineTo(x - 5, y + 4); ctx.lineTo(x - 10, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = g.profile.muted ? C.red : C.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (g.profile.muted) { ctx.moveTo(x + 5, y - 5); ctx.lineTo(x + 13, y + 5); ctx.moveTo(x + 13, y - 5); ctx.lineTo(x + 5, y + 5); }
  else { ctx.arc(x + 3, y, 6, -0.9, 0.9); ctx.moveTo(x + 7, y - 9); ctx.arc(x + 3, y, 10, -0.9, 0.9); }
  ctx.stroke();
  hits.push({ id: 'mute', x: x - 24, y: y - 24, w: 48, h: 48 });
}

function drawHud(ctx, g, v) {
  const top = v.safeTop + 8, x = 8, w = v.w - 16, h = 44;
  panel(ctx, x, top, w, h, C.paper, { r: 3, shadow: 4, lw: 4 });
  inkText(ctx, `LV ${g.level.n}`, x + 38, top + h / 2, 18, C.yellow);
  const bx = 80, bw = w - 140, by = top + 15;
  panel(ctx, bx, by, bw, 14, C.paper, { r: 7, shadow: 0, lw: 3 });
  const p = g.state === 'run' ? Math.min(1, g.glitch.y / g.stopY) : 1;
  if (p > 0.05) panel(ctx, bx, by, bw * p, 14, C.yellow, { r: 7, shadow: 0, lw: 3, dots: C.red });
  panel(ctx, bx + bw - 10, by - 4, 14, 22, C.red, { r: 2, shadow: 0, lw: 3 });
  muteButton(ctx, g, v.w - 36, top + h / 2);
}

function drawTitle(ctx, g, v) {
  const y = Math.max(v.safeTop + 70, v.h * 0.17), p = g.profile;
  inkText(ctx, 'BYTE', v.w / 2 - 10, y, 70, C.yellow);
  inkText(ctx, 'TRAIL', v.w / 2 + 14, y + 64, 70, C.red);
  caption(ctx, 'COMIC EDITION', v.w / 2, y + 114, 16, C.magenta, { color: C.paper, tilt: 0.04 });
  drawGlitch(ctx, v.w / 2, v.h * 0.52 + Math.sin(g.time * 3) * 5,
    { scale: 2.2, t: g.time, visor: visorColor(p.visor), face: 'happy' });
  caption(ctx, 'DRAG TO STEER', v.w / 2, v.h * 0.655, 16, C.paper);
  plainText(ctx, `BEST LV ${p.best}   ${p.coins} COINS`, v.w / 2, v.h * 0.7, 14);
  button(ctx, hits, 'play', `PLAY LV ${g.level.n}`, v.w / 2, v.h * 0.78, 220, 56, C.yellow, C.ink, 22);
  button(ctx, hits, 'shop', 'SHOP', v.w / 2, v.h * 0.78 + 66, 150, 46, C.paper);
  muteButton(ctx, g, v.w - 36, v.safeTop + 30);
}

function result(ctx, v, h) {
  const w = 316, x = (v.w - w) / 2, y = Math.max(v.safeTop + 70, v.h * 0.5 - h / 2);
  panel(ctx, x, y, w, h, C.paper, { r: 4, shadow: 7, lw: 4, tone: true });
  return y;
}

function adButton(ctx, id, label, cx, cy) {
  button(ctx, hits, id, label, cx, cy, 272, 50, C.magenta, C.paper);
  if (hasAds) caption(ctx, 'AD', cx + 126, cy - 24, 11, C.yellow, { tilt: 0.1 });
}

function drawClear(ctx, g, v) {
  const offer = !g.overclocked && g.coins > 0, y = result(ctx, v, offer ? 300 : 240);
  inkText(ctx, 'FIREWALL DOWN!', v.w / 2, y + 40, 28, C.green);
  plainText(ctx, `${g.bytes} BYTES ×${g.mult} BONUS`, v.w / 2, y + 82, 15);
  caption(ctx, `+${g.coins} COINS`, v.w / 2, y + 122, 22, C.yellow);
  if (g.stateT < 1.2) burst(ctx, 'KA-CHING!', v.w / 2 + 96, y + 96, 13, C.yellow, C.green, 3, Math.min(1, g.stateT * 6));
  let row = y + 186;
  if (offer) { adButton(ctx, 'overclock', 'OVERCLOCK ×3 COINS', v.w / 2, row); row += 64; }
  button(ctx, hits, 'shop', 'SHOP', v.w / 2 - 82, row, 112, 50, C.paper);
  button(ctx, hits, 'next', 'NEXT', v.w / 2 + 62, row, 152, 50, C.yellow, C.ink, 22);
}

function drawFail(ctx, g, v) {
  const offer = !g.rebootUsed && g.bossBytes > 0, y = result(ctx, v, offer ? 250 : 190);
  inkText(ctx, 'BLOCKED!', v.w / 2, y + 42, 42, C.red);
  plainText(ctx, `FIREWALL HP LEFT ${g.hp}`, v.w / 2, y + 92, 16);
  let row = y + 144;
  if (offer) { adButton(ctx, 'reboot', 'REBOOT +50% BYTES', v.w / 2, row); row += 64; }
  button(ctx, hits, 'retry', 'RETRY', v.w / 2, row, 200, 50, C.yellow, C.ink, 22);
}
