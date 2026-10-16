// One-finger relative drag (touch or mouse), arrow keys, taps with positions.
const TAP_SLOP = 12;
const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];

export function createInput(canvas, onGesture) {
  let dx = 0, taps = [], id = null, lastX = 0, moved = 0, enabled = true;
  const keys = new Set();

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    onGesture();
    if (!enabled || id !== null) return;
    id = e.pointerId;
    canvas.setPointerCapture(id);
    lastX = e.clientX;
    moved = 0;
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    dx += e.clientX - lastX;
    moved += Math.abs(e.clientX - lastX);
    lastX = e.clientX;
  });
  const end = e => {
    if (e.pointerId !== id) return;
    if (e.type === 'pointerup' && moved < TAP_SLOP) taps.push({ x: e.clientX, y: e.clientY });
    id = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    onGesture();
    if (!enabled) return;
    keys.add(e.code);
    if (!e.repeat && (e.code === 'Space' || e.code === 'Enter')) { taps.push(null); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));

  const held = list => list.some(k => keys.has(k));

  return {
    // Drains what happened since the last frame. dx and tap positions are in CSS pixels; null tap = keyboard.
    read() {
      const out = { dx, taps, axis: held(RIGHT) - held(LEFT) };
      dx = 0;
      taps = [];
      return out;
    },
    setEnabled(on) {
      enabled = on;
      dx = 0;
      taps = [];
      id = null;
      keys.clear();
    },
  };
}
