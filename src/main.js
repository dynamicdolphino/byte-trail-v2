// Boot: platform, save data, canvas sizing, fixed-timestep loop, pause and audio wiring.
import * as platform from './platform.js';
import { Game, loadProfile } from './game.js';
import { render, hits } from './render.js';
import { createInput } from './input.js';
import { unlock, setBlock } from './audio.js';

const STEP = 1 / 120;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const safeTop = document.getElementById('safe-top');

// Logical playfield is 360 units wide; height follows the screen aspect.
const view = { w: 360, h: 640, scale: 1, offX: 0, dpr: 1, cssW: 0, cssH: 0, safeTop: 0 };

function resize() {
  const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const scale = Math.min(cssW / view.w, cssH / 560);
  Object.assign(view, {
    cssW, cssH, dpr, scale,
    h: cssH / scale,
    offX: (cssW - view.w * scale) / 2,
    safeTop: safeTop.offsetHeight / scale,
  });
}

async function boot() {
  await platform.init();
  const level = parseInt(new URLSearchParams(location.search).get('level'), 10);
  const game = new Game(loadProfile(await platform.load()), level > 0 ? level : 0);
  const input = createInput(canvas, unlock);
  let acc = 0, last = 0, raf = 0, paused = false;

  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    game.handleInput(input.read(), view, hits);
    while (acc >= STEP) { game.update(STEP); acc -= STEP; }
    render(ctx, game, view);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(frame);
  }

  // Pause stops the loop, audio and input.
  platform.onPause(() => {
    if (paused) return;
    paused = true;
    cancelAnimationFrame(raf);
    input.setEnabled(false);
    setBlock('paused', true);
  });
  platform.onResume(() => {
    if (!paused) return;
    paused = false;
    input.setEnabled(true);
    setBlock('paused', false);
    start();
  });
  setBlock('platform', !platform.isAudioEnabled());
  platform.onAudioChange(on => setBlock('platform', !on));

  window.addEventListener('resize', resize);
  resize();
  render(ctx, game, view);
  platform.firstFrameReady();
  platform.gameReady();
  start();
}

boot();
