// Tiny WebAudio blips generated in code. Silent while muted, paused, during ads or when the platform disables audio.
let ac = null, noiseBuf = null;
const block = { platform: false, muted: false, paused: false, ad: false };

const live = () => ac && !Object.values(block).some(Boolean);

function sync() {
  if (!ac) return;
  if (live()) ac.resume(); else ac.suspend();
}

export function setBlock(reason, on) {
  block[reason] = on;
  sync();
}

// The context may only start from a user gesture.
export function unlock() {
  if (!ac) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    ac = new A();
  }
  sync();
}

function tone(f0, f1, dur, type = 'square', vol = 0.06, delay = 0) {
  if (!live()) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol) {
  if (!live()) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime, s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = noiseBuf;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g).connect(ac.destination);
  s.start(t);
  s.stop(t + dur);
}

export const sfx = {
  click: () => tone(700, 700, 0.04, 'square', 0.04),
  good: () => tone(520, 1040, 0.12),
  bad: () => tone(320, 140, 0.18, 'sawtooth', 0.05),
  pow: () => { noise(0.15, 0.2); tone(220, 880, 0.16, 'square', 0.07); },
  hurt: () => { noise(0.2, 0.2); tone(220, 60, 0.3, 'sawtooth', 0.07); },
  zap: () => tone(1500, 300, 0.07, 'square', 0.035),
  hit: () => tone(190, 90, 0.05, 'square', 0.04),
  boom: () => { noise(0.45, 0.35); tone(130, 40, 0.45, 'triangle', 0.25); },
  step: k => tone(380 + k * 120, 380 + k * 120, 0.09, 'triangle', 0.09),
  coin: () => { tone(988, 988, 0.08, 'square', 0.05); tone(1319, 1319, 0.28, 'square', 0.05, 0.08); },
  fail: () => tone(420, 90, 0.55, 'sawtooth', 0.06),
};
