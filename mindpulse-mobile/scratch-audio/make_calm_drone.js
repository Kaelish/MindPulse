/**
 * Generates ../assets/audio/calm-drone.wav — a seamless 10 s ambient pad that
 * ships as the built-in "Calming music" track so the player works before any
 * royalty-free files have been dropped in.
 *
 * Pure Node, no dependencies:
 *   node scratch-audio/make_calm_drone.js
 *
 * Two things make the loop click-free:
 *   1. Every oscillator frequency is snapped to a multiple of 1/loop-seconds,
 *      so each partial completes a whole number of cycles over the file.
 *   2. The noise texture's last second is cross-faded into its first second.
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const SECONDS = 10;
const N = SAMPLE_RATE * SECONDS;
const HZ_GRID = 1 / SECONDS; // 0.1 Hz — the finest grid a 10 s loop can hold

const snap = (f) => Math.round(f / HZ_GRID) * HZ_GRID;

// A minor-ish pad: A2, E3, A3, C4, E4.
const PARTIALS = [
  [110.0, 0.9],
  [164.81, 0.55],
  [220.0, 0.45],
  [261.63, 0.4],
  [329.63, 0.3],
].map(([f, a]) => [snap(f), a]);

// Slow "breathing" swells. Each period divides the loop exactly.
const SWELLS = [
  [0.1, 0.35], // one swell across the whole 10 s
  [0.2, 0.15], // one across 5 s
];

const out = new Float64Array(N);

for (let i = 0; i < N; i++) {
  const t = i / SAMPLE_RATE;
  let s = 0;
  for (const [f, a] of PARTIALS) {
    let amp = a;
    for (const [sf, depth] of SWELLS) {
      // Ranges from (1 - depth) to 1, so nothing ever drops to silence.
      amp *= 1 - depth / 2 + (depth / 2) * Math.cos(2 * Math.PI * sf * t);
    }
    s += amp * Math.sin(2 * Math.PI * f * t);
  }
  out[i] = s;
}

// ── Soft noise texture, cross-faded so the tail flows into the head ──────────
const NOISE_LEVEL = 0.05;
const FADE = SAMPLE_RATE; // 1 s
const noise = new Float64Array(N + FADE);

let lp = 0;
for (let i = 0; i < noise.length; i++) {
  const white = Math.random() * 2 - 1;
  lp += 0.02 * (white - lp); // one-pole low-pass -> soft "shhh" instead of hiss
  noise[i] = lp;
}

let noisePeak = 0;
for (let i = 0; i < noise.length; i++) noisePeak = Math.max(noisePeak, Math.abs(noise[i]));

for (let i = 0; i < N; i++) {
  let n;
  if (i < N - FADE) {
    n = noise[i];
  } else {
    const w = (i - (N - FADE)) / FADE;
    n = noise[i] * (1 - w) + noise[i - (N - FADE)] * w;
  }
  out[i] += (NOISE_LEVEL * n) / noisePeak;
}

// ── Normalise and write 16-bit mono PCM ──────────────────────────────────────
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]));
const gain = peak > 0 ? 0.7 / peak : 1;

const dataSize = N * 2;
const buf = Buffer.alloc(44 + dataSize);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(SAMPLE_RATE, 24);
buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(dataSize, 40);

for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, out[i] * gain));
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}

const dest = path.join(__dirname, '..', 'assets', 'audio', 'calm-drone.wav');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, buf);

console.log(`wrote ${dest} (${(buf.length / 1024).toFixed(0)} KB, ${SECONDS}s loop)`);
