// Glitch: chunky comic robot head. The visor face reads ">_" and changes with mood.
import { C, INK_W, rr, panel, disc } from './comic.js';

function eyes(ctx, face, t, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  switch (face) {
    case 'happy':
      ctx.moveTo(-11, 3); ctx.lineTo(-7, -3); ctx.lineTo(-3, 3);
      ctx.moveTo(3, 3); ctx.lineTo(7, -3); ctx.lineTo(11, 3);
      ctx.stroke();
      break;
    case 'worried':
      ctx.moveTo(-11, -4); ctx.lineTo(-4, -1);
      ctx.moveTo(11, -4); ctx.lineTo(4, -1);
      ctx.stroke();
      ctx.fillRect(-9, 1, 4, 4);
      ctx.fillRect(5, 1, 4, 4);
      break;
    case 'shocked':
      ctx.arc(-7, 0.5, 4, 0, Math.PI * 2);
      ctx.moveTo(11, 0.5);
      ctx.arc(7, 0.5, 4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    default:
      ctx.moveTo(-10, -4); ctx.lineTo(-5, 0.5); ctx.lineTo(-10, 5);
      ctx.stroke();
      if (t % 1 < 0.6) ctx.fillRect(1, 3, 9, 3);
  }
}

export function drawGlitch(ctx, x, y, { tilt = 0, t = 0, scale = 1, visor = C.green, face = 'neutral' } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);
  if (face === 'shocked') ctx.translate(Math.sin(t * 60) * 1.2, 0);

  // Antenna
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = INK_W;
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(3, -29); ctx.stroke();
  disc(ctx, 3, -31, 5, face === 'worried' && t % 0.4 < 0.2 ? C.yellow : C.red, 0);

  // Head with halftone shading, then ear bolts over its edges
  panel(ctx, -20, -18, 40, 36, C.blue, { r: 9, shadow: 4, tone: true });
  panel(ctx, -25, -6, 7, 14, C.yellow, { r: 2, shadow: 0, lw: 3 });
  panel(ctx, 18, -6, 7, 14, C.yellow, { r: 2, shadow: 0, lw: 3 });
  ctx.fillStyle = C.paper;
  rr(ctx, -14, -14, 10, 4, 2);
  ctx.fill();

  panel(ctx, -15, -8, 30, 17, C.ink, { r: 5, shadow: 0 });
  eyes(ctx, face, t, visor);

  // Mouth grill
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const gx of [-6, 0, 6]) { ctx.moveTo(gx, 11); ctx.lineTo(gx, 15); }
  ctx.stroke();
  ctx.restore();
}
