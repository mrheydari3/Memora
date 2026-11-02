/**
 * Generates the four quiz sound effects as 16-bit mono WAV files.
 *
 * The app ships no third-party audio: these are synthesised tones written by
 * this script, so the repository stays self-contained and licence-free.
 *
 *   node scripts/make-sfx.mjs
 *
 * Output: assets/sfx/{correct,wrong,combo,end}.wav
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');

/** One sine note with a short attack and an exponential decay. */
function note(freq, durationMs, { gain = 0.5, attackMs = 6, decay = 6 } = {}) {
  const length = Math.round((durationMs / 1000) * RATE);
  const attack = Math.round((attackMs / 1000) * RATE);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    const env =
      (i < attack ? i / attack : 1) * Math.exp((-decay * i) / length);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * gain;
  }
  return samples;
}

function silence(durationMs) {
  return new Float32Array(Math.round((durationMs / 1000) * RATE));
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Normalise to -1..1 so no clip can produce a crackle. */
function normalise(samples, peak = 0.85) {
  let max = 0;
  for (const value of samples) max = Math.max(max, Math.abs(value));
  if (max === 0) return samples;
  const scale = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return samples;
}

function toWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(RATE, 24);
  buffer.writeUInt32LE(RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

const sounds = {
  // Two rising notes: unmistakably "right" without being shrill.
  correct: normalise(concat([note(880, 70), note(1320, 110, { decay: 8 })])),
  // A short falling pair, soft-edged so it reads as feedback, not an alarm.
  wrong: normalise(
    concat([note(220, 90, { decay: 5 }), note(165, 150, { decay: 7, gain: 0.45 })])
  ),
  // Bright rising blip for a combo step.
  combo: normalise(concat([note(1200, 50, { gain: 0.4 }), note(1800, 70, { gain: 0.35 })])),
  // Three-note major arpeggio for the result screen.
  end: normalise(
    concat([note(660, 110), note(880, 110), note(1100, 260, { decay: 5 })])
  ),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, toWav(samples));
  console.log(`${name}.wav  ${(samples.length / RATE * 1000).toFixed(0)}ms`);
}
