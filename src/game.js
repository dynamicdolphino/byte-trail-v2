// Game state machine: title | shop | run -> boss -> bonus -> clear | fail.
import { buildLevel, TRACK, WALL_H, STEPS_AT, STEP_GAP } from './level.js';
import { applyOp, opLabel, opGood, snakePoint, snakeHits, inCone, CONE_R } from './entities.js';
import { Trail } from './trail.js';
import { sfx, setBlock } from './audio.js';
import { shopItems } from './shop.js';
import * as platform from './platform.js';

const STEER = 1.3;        // logical units per CSS pixel of drag (scaled)
const KEY_SPEED = 320;    // units/s with arrow keys
const STOP_GAP = 75;      // Glitch stops this far before the firewall
const OVERLAY_LOCK = 0.45;
const SHOT_TIME = 0.3;
const EDGE = 18;
const HEAD_R = 18;
const ZAP_TICK = 0.2;
const BONUS_SPEED = 300;
const AD_EVERY = 3;       // interstitial at most every 3 levels
const PLAYING = new Set(['run', 'boss', 'bonus']);
const DEFAULT_ACTION = { title: 'play', clear: 'next', fail: 'retry' };

export function loadProfile(str) {
  const base = { level: 1, best: 1, coins: 0, visors: ['green'], trails: ['classic'], visor: 'green', trail: 'classic', muted: false };
  try { return { ...base, ...JSON.parse(str) }; } catch { return base; }
}

export class Game {
  constructor(profile, startLevel) {
    this.profile = profile;
    this.trail = new Trail();
    this.time = 0;
    this.shake = 0;
    this.levelsSinceAd = 0;
    this.busy = false;
    this.shopTab = 'visor';
    this.shopMsgT = 0;
    this.playing = false;
    setBlock('muted', profile.muted);
    this.load(startLevel || profile.level);
    this.setState('title');
  }

  load(n) {
    const L = this.level = buildLevel(n);
    this.snakes = L.snakes.map(s => ({ ...s, alive: true }));
    this.glitch = { x: TRACK.cx, y: 0, tilt: 0, lastX: TRACK.cx };
    this.bytes = L.startBytes;
    this.hp = L.bossHp;
    this.t = 0;
    this.gateIdx = 0;
    this.shots = [];
    this.fx = [];
    this.fightAcc = 0;
    this.hitCount = 0;
    this.zapAcc = 0;
    this.zapCount = 0;
    this.inCone = false;
    this.face = 'neutral';
    this.faceT = 0;
    this.bossBytes = 0;
    this.rebootUsed = false;
    this.overclocked = false;
    this.coins = 0;
    this.mult = 1;
    this.climbed = 0;
    this.trail.reset(TRACK.cx, 0);
  }

  setState(s) {
    const playing = PLAYING.has(s);
    if (playing !== this.playing) {
      this.playing = playing;
      if (playing) platform.gameplayStart(); else platform.gameplayStop();
    }
    this.state = s;
    this.stateT = 0;
  }

  get stopY() { return this.level.length - STOP_GAP; }
  stepBottom(k) { return this.level.length + STEPS_AT + (k - 1) * STEP_GAP; }

  save() { platform.save(JSON.stringify(this.profile)); }

  // ---- input ----

  handleInput({ dx, taps, axis }, v, hits) {
    this.axis = axis;
    if (this.state === 'run') this.steer(dx / v.scale * STEER);
    if (this.busy || this.stateT < OVERLAY_LOCK) return;
    for (const p of taps) {
      const x = p && (p.x - v.offX) / v.scale, y = p && p.y / v.scale;
      const hit = p && hits.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      this.press(hit ? hit.id : DEFAULT_ACTION[this.state]);
    }
  }

  press(id) {
    if (!id) return;
    sfx.click();
    const [kind, arg] = id.split(':');
    switch (kind) {
      case 'play': this.setState('run'); break;
      case 'next': this.next(); break;
      case 'retry': this.load(this.level.n); this.setState('run'); break;
      case 'shop': this.shopFrom = this.state; this.setState('shop'); break;
      case 'back': this.setState(this.shopFrom); this.stateT = OVERLAY_LOCK; break;
      case 'tab': this.shopTab = arg; break;
      case 'item': this.pick(arg); break;
      case 'mute':
        this.profile.muted = !this.profile.muted;
        setBlock('muted', this.profile.muted);
        this.save();
        break;
      case 'overclock': case 'reboot': this.reward(kind); break;
    }
  }

  async next() {
    if (++this.levelsSinceAd >= AD_EVERY) {
      this.levelsSinceAd = 0;
      await this.ad(() => platform.showInterstitial());
    }
    this.load(this.level.n + 1);
    this.setState('run');
  }

  async ad(show) {
    this.busy = true;
    setBlock('ad', true);
    const result = await show();
    setBlock('ad', false);
    this.busy = false;
    return result;
  }

  async reward(kind) {
    if (!(await this.ad(() => platform.showRewarded(kind)))) return;
    if (kind === 'overclock' && !this.overclocked) {
      this.overclocked = true;
      this.profile.coins += this.coins * 2;
      this.coins *= 3;
      this.save();
      this.stateT = 0;
      sfx.coin();
    } else if (kind === 'reboot' && !this.rebootUsed) {
      this.rebootUsed = true;
      this.bytes = Math.ceil(this.bossBytes * 1.5);
      this.hp = this.level.bossHp;
      this.fightAcc = 0;
      this.setState('boss');
    }
  }

  pick(id) {
    const tab = this.shopTab, p = this.profile;
    const item = shopItems(tab).find(it => it.id === id);
    const owned = tab === 'trail' ? p.trails : p.visors;
    if (!owned.includes(id)) {
      if (p.coins < item.price) { this.shopMsgT = this.time + 1.5; sfx.bad(); return; }
      p.coins -= item.price;
      owned.push(id);
      sfx.coin();
    }
    p[tab] = id;
    this.save();
  }

  steer(d) {
    const g = this.glitch;
    g.x = Math.min(TRACK.r - EDGE, Math.max(TRACK.l + EDGE, g.x + d));
  }

  // ---- effects ----

  pop(kind, text, x, y, style, life = 0.9) {
    this.fx.push({ kind, text, x, y, style, t: 0, life, seed: this.fx.length + this.time * 10 });
  }

  emote(face, time) { this.face = face; this.faceT = time; }

  // ---- simulation ----

  update(dt) {
    if (this.busy) return;
    this.time += dt;
    this.stateT += dt;
    if (this.state === 'run') this.run(dt);
    else if (this.state === 'boss') this.fight(dt);
    else if (this.state === 'bonus') this.climb(dt);

    const g = this.glitch;
    const lean = Math.max(-0.4, Math.min(0.4, (g.x - g.lastX) / dt * 0.0012));
    g.tilt += (lean - g.tilt) * Math.min(1, dt * 12);
    g.lastX = g.x;

    for (const s of this.shots) s.t += dt / SHOT_TIME;
    this.shots = this.shots.filter(s => s.t < 1);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.life);
    this.shake *= Math.exp(-9 * dt);

    if (this.faceT > 0) this.faceT -= dt;
    else this.face = this.inCone || (this.playing && this.bytes <= 3) ? 'worried' : 'neutral';
  }

  run(dt) {
    const g = this.glitch, L = this.level;
    this.t += dt;
    if (this.axis) this.steer(this.axis * KEY_SPEED * dt);
    g.y = Math.min(g.y + L.speed * dt, this.stopY);
    this.trail.push(g.x, g.y);

    while (this.gateIdx < L.gates.length && L.gates[this.gateIdx].y <= g.y) {
      const gate = L.gates[this.gateIdx++];
      const o = gate.hit = g.x < TRACK.cx ? gate.left : gate.right;
      this.bytes = applyOp(this.bytes, o);
      const good = opGood(o);
      this.pop('cap', opLabel(o), g.x, g.y + 40, good ? 'good' : 'bad');
      if (good) { sfx.good(); this.emote('happy', 0.6); }
      else { sfx.bad(); this.emote('shocked', 0.6); this.shake = 4; }
    }

    for (const s of this.snakes) {
      if (!s.alive || Math.abs(snakePoint(s, this.t, 0)[1] - g.y) > 200 || !snakeHits(s, this.t, g.x, g.y, HEAD_R)) continue;
      s.alive = false;
      if (this.bytes > s.len) {
        this.bytes += s.len;
        this.pop('burst', 'POW!', g.x, g.y + 50, 'pow');
        this.pop('cap', `+${s.len}`, g.x + 40, g.y + 20, 'good');
        sfx.pow();
        this.emote('happy', 0.9);
        this.shake = 6;
      } else {
        this.bytes = Math.max(0, this.bytes - s.len);
        this.pop('burst', 'CRUNCH!', g.x, g.y + 50, 'ouch');
        this.pop('cap', `-${s.len}`, g.x + 40, g.y + 20, 'bad');
        sfx.hurt();
        this.emote('shocked', 1);
        this.shake = 9;
      }
    }

    this.inCone = L.scanners.some(sc =>
      Math.abs(sc.y - g.y) < CONE_R && inCone(sc, sc.side < 0 ? TRACK.l : TRACK.r, this.t, g.x, g.y));
    if (this.inCone) {
      this.zapAcc += dt;
      while (this.zapAcc >= ZAP_TICK) {
        this.zapAcc -= ZAP_TICK;
        if (!this.bytes) break;
        this.bytes--;
        sfx.zap();
        this.shake = Math.max(this.shake, 2);
        if (this.zapCount++ % 3 === 0) this.pop('burst', 'ZAP!', g.x + 30, g.y + 45, 'zap', 0.5);
      }
    } else {
      this.zapAcc = 0;
    }

    if (g.y >= this.stopY) {
      this.bossBytes = this.bytes;
      this.setState('boss');
    }
  }

  // Bytes hit the firewall one at a time; the whole fight lasts about 2 s or less.
  fight(dt) {
    this.t += dt;
    const wall = this.level.length;
    this.fightAcc += Math.max(14, this.level.bossHp / 2.2) * dt;
    while (this.fightAcc >= 1 && this.bytes > 0 && this.hp > 0) {
      this.fightAcc -= 1;
      this.bytes--;
      this.hp--;
      this.shots.push({ t: 0, x: this.glitch.x + (Math.random() - 0.5) * 60 });
      sfx.hit();
      if (++this.hitCount % 7 === 0) {
        this.pop('burst', 'BOOM!', TRACK.l + 60 + Math.random() * 200, wall + 30 + Math.random() * 60, 'boom', 0.5);
        this.shake = Math.max(this.shake, 3);
      }
    }
    if (this.hp <= 0) {
      this.pop('burst', 'BOOM!', TRACK.cx, wall + WALL_H / 2, 'boom', 1.1);
      sfx.boom();
      this.shake = 12;
      this.emote('happy', 3);
      const cost = Math.max(4, Math.round(this.level.bossHp * 0.25));
      this.mult = Math.min(5, 1 + Math.floor(this.bytes / cost));
      this.climbed = 0;
      this.setState('bonus');
    } else if (this.bytes <= 0) {
      sfx.fail();
      this.emote('shocked', 2);
      this.setState('fail');
    }
  }

  // Run up the multiplier steps; leftover bytes times the reached step = coins.
  climb(dt) {
    const g = this.glitch, target = this.stepBottom(this.mult) + STEP_GAP / 2;
    if (g.y < target) {
      g.y = Math.min(target, g.y + BONUS_SPEED * dt);
      this.trail.push(g.x, g.y);
      while (this.climbed < this.mult && g.y >= this.stepBottom(this.climbed + 1)) {
        this.climbed++;
        sfx.step(this.climbed);
        this.pop('cap', `×${this.climbed}`, g.x + 50, g.y, 'good', 0.6);
      }
      if (g.y >= target) this.finish();
    }
  }

  finish() {
    const p = this.profile, n = this.level.n;
    this.coins = this.bytes * this.mult;
    p.coins += this.coins;
    p.level = n + 1;
    if (n + 1 > p.best) { p.best = n + 1; platform.sendScore(p.best); }
    this.save();
    sfx.coin();
    this.setState('clear');
  }
}

