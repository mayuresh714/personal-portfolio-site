// audio.js — synthesized sound effects (no asset files). A single lazily-created
// AudioContext; each cue is a short blip so the game feels tactile like chess.com.

let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function blip(freq, dur, type = 'sine', gain = 0.14, glideTo = null) {
  if (!enabled) return;
  const a = ac();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, a.currentTime + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + dur + 0.02);
}

export const Sound = {
  setEnabled(v) { enabled = v; },
  isEnabled() { return enabled; },
  move() { blip(320, 0.08, 'sine', 0.12); },
  capture() { blip(200, 0.11, 'triangle', 0.18); setTimeout(() => blip(140, 0.09, 'square', 0.10), 40); },
  select() { blip(520, 0.03, 'sine', 0.06); },
  check() { blip(660, 0.14, 'sawtooth', 0.14, 880); },
  reveal() { blip(300, 0.16, 'sawtooth', 0.16, 700); setTimeout(() => blip(720, 0.18, 'triangle', 0.16), 90); },
  intel() { blip(880, 0.06, 'sine', 0.10); setTimeout(() => blip(1180, 0.06, 'sine', 0.09), 60); },
  hit() { blip(160, 0.2, 'square', 0.18, 90); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.16), i * 110)); },
  lose() { [400, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sine', 0.14), i * 130)); },
};
