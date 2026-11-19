// Pre-renders the web game's synthesized sound effects and music to WAV files.
// tvOS has no Web Audio, so this reproduces the recipes from ../party-game/game.js
// (SFX + startMusic + startSuspense) offline: the same oscillators, envelopes,
// exponential slides, biquad filters, noise bursts, master gain (1.9) and a
// limiter modelled on the web game's DynamicsCompressor. Output: assets/audio/*.wav
//   node scripts/render-audio.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "assets", "audio");
mkdirSync(outDir, { recursive: true });

// Seeded random numbers, so re-running the script gives identical files.
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- Web Audio-style building blocks ---------- */
// An AudioParam timeline: setValueAtTime / exponentialRamp / linearRamp.
class Param {
  constructor(v) { this.def = v; this.ev = []; }
  set(v, t) { this.ev.push({ k: "set", t, v }); return this; }
  exp(v, t) { this.ev.push({ k: "exp", t, v }); return this; }
  lin(v, t) { this.ev.push({ k: "lin", t, v }); return this; }
  at(t) {
    const ev = this.ev;
    if (!ev.length || t < ev[0].t) return this.def;
    let i = 0;
    while (i + 1 < ev.length && ev[i + 1].t <= t) i++;
    const a = ev[i], b = ev[i + 1];
    if (b && b.k !== "set") {
      const f = (t - a.t) / (b.t - a.t);
      if (b.k === "lin") return a.v + (b.v - a.v) * f;
      return a.v * Math.pow(b.v / a.v, f);
    }
    return a.v;
  }
}

// RBJ biquad with Web Audio's Q conventions (lowpass/highpass Q is in dB).
class Biquad {
  constructor(type, freq, q, sr) { this.type = type; this.freq = freq; this.q = q; this.sr = sr; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.lastF = -1; }
  coeffs(f) {
    const w0 = 2 * Math.PI * Math.min(f, this.sr * 0.49) / this.sr, cs = Math.cos(w0), sn = Math.sin(w0);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === "bandpass") {
      const alpha = sn / (2 * this.q);
      b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
    } else {
      const alpha = sn / (2 * Math.pow(10, this.q / 20));
      if (this.type === "lowpass") { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
      else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
      a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x, t) {
    const f = typeof this.freq === "number" ? this.freq : this.freq.at(t);
    if (f !== this.lastF) { this.coeffs(f); this.lastF = f; }
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// Band-limited (polyBLEP) oscillators.
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
function oscSample(type, ph, dt) {
  switch (type) {
    case "sine": return Math.sin(2 * Math.PI * ph);
    case "triangle": return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
    case "square": return (ph < 0.5 ? 1 : -1) + blep(ph, dt) - blep((ph + 0.5) % 1, dt);
    case "sawtooth": return 2 * ph - 1 - blep(ph, dt);
  }
  return 0;
}

class Mix {
  constructor(seconds, sr, seed = 1) { this.sr = sr; this.buf = new Float64Array(Math.ceil(seconds * sr)); this.rand = mulberry32(seed); }
  // Render one source from t0 to t1. src(t) -> sample; gain: Param; filters: Biquad[]; post(t, x) optional.
  voice(t0, t1, src, gain, filters = [], post) {
    const sr = this.sr, s0 = Math.max(0, Math.floor(t0 * sr)), s1 = Math.min(this.buf.length, Math.ceil(t1 * sr));
    for (let s = s0; s < s1; s++) {
      const t = s / sr;
      let x = src(t);
      for (const f of filters) x = f.run(x, t);
      if (post) x = post(t, x);
      this.buf[s] += x * gain.at(t);
    }
  }
  osc(type, freq, t0, t1, gain, filters, opts = {}) {
    let ph = 0, last = t0;
    const sr = this.sr;
    const fq = typeof freq === "number" ? new Param(freq) : freq;
    const cents = Math.pow(2, (opts.detune || 0) / 1200);
    this.voice(t0, t1, (t) => {
      let f = fq.at(t) * cents;
      if (opts.vibrato) f += 8 * Math.sin(2 * Math.PI * opts.vibrato * (t - t0));
      const dt = f / sr;
      const v = oscSample(type, ph, dt);
      ph += dt; ph -= Math.floor(ph); last = t;
      return v;
    }, gain, filters, opts.post);
  }
  noise(t0, t1, gain, filters) {
    this.voice(t0, t1, () => this.rand() * 2 - 1, gain, filters);
  }
}

/* ---------- the web game's SFX recipes ---------- */
function makeSfx(m) {
  const sr = m.sr;
  const tone = (freq, at, dur, type = "triangle", vol = 0.3, opts = {}) => {
    const t = at;
    const f = Array.isArray(freq) ? new Param(freq[0]).set(freq[0], t).exp(freq[1], t + dur) : freq;
    const g = new Param(0).set(0.0001, t).exp(vol, t + (opts.attack || 0.01)).exp(0.0001, t + dur);
    const filters = opts.lowpass ? [new Biquad("lowpass", opts.lowpass, 1, sr)] : [];
    m.osc(type, f, t, t + dur + 0.05, g, filters, { vibrato: opts.vibrato });
  };
  const noise = (at, dur, freq, vol = 0.2, type = "bandpass", q = 1) => {
    const g = new Param(0).set(vol, at).exp(0.0001, at + dur);
    m.noise(at, at + dur + 0.02, g, [new Biquad(type, freq, q, sr)]);
  };
  const S = {
    move()    { tone(1200, 0, 0.03, "sine", 0.05); },
    click()   { tone([700, 500], 0, 0.06, "sine", 0.12); },
    reveal()  { tone([900, 420], 0, 0.09, "sine", 0.22); noise(0, 0.05, 2500, 0.05); },
    help()    { noise(0, 0.22, 1800, 0.18, "bandpass", 0.8); tone([500, 760], 0.02, 0.16, "sine", 0.08); },
    correct() { [1047, 1319, 1568, 2093].forEach((f, i) => { tone(f, i * 0.07, 0.35, "triangle", 0.22); tone(f * 2, i * 0.07, 0.2, "sine", 0.05); }); },
    wrong()   { tone(150, 0, 0.28, "square", 0.16, { lowpass: 900 }); tone(110, 0.3, 0.42, "square", 0.16, { lowpass: 700 }); },
    bet()     { tone(988, 0, 0.09, "square", 0.12, { lowpass: 4000 }); tone(1319, 0.09, 0.45, "square", 0.12, { lowpass: 4000 }); noise(0.09, 0.12, 6000, 0.05, "highpass"); },
    lose()    { [392, 370, 349, 294].forEach((f, i) => tone(f, i * 0.32, i === 3 ? 0.9 : 0.3, "sawtooth", 0.14, { lowpass: 1200, vibrato: i === 3 ? 6 : 0 })); },
    drumroll(len = 1.1) { for (let t = 0; t < len; t += 0.045) noise(t, 0.06, 180, 0.12 + 0.12 * (t / len), "lowpass"); noise(len, 0.35, 120, 0.4, "lowpass"); },
    fanfare(at = 0) {
      [[523, 0], [659, 0.14], [784, 0.28]].forEach(([f, d]) => tone(f, at + d, 0.18, "sawtooth", 0.12, { lowpass: 2400 }));
      [523, 659, 784, 1047].forEach((f) => tone(f, at + 0.44, 0.9, "sawtooth", 0.09, { lowpass: 2400, attack: 0.03 }));
    },
    applause(at = 0, len = 2.2) { for (let t = 0; t < len; t += 0.024) noise(at + t + m.rand() * 0.012, 0.045, 1500 + m.rand() * 2500, 0.08 * (1 - t / len) + 0.014); },
    final()   { S.drumroll(0.9); S.fanfare(1.0); },
    win()     { S.fanfare(0); S.applause(0.4); },
    dare()    { tone([660, 520], 0, 0.18, "sine", 0.2); tone([520, 330], 0.2, 0.3, "sine", 0.2); },
    steal()   { [784, 988, 1175].forEach((f, i) => tone(f, 0.25 + i * 0.07, 0.14, "square", 0.1, { lowpass: 3000 })); },
    tick()    { tone(1760, 0, 0.06, "square", 0.08, { lowpass: 3000 }); },
    timeup()  { tone(880, 0, 0.12, "square", 0.14, { lowpass: 2500 }); tone(880, 0.16, 0.12, "square", 0.14, { lowpass: 2500 }); tone(880, 0.32, 0.4, "square", 0.14, { lowpass: 2500 }); }
  };
  return S;
}
const SFX_LENGTH = { move: 0.1, click: 0.15, reveal: 0.2, help: 0.3, correct: 0.6, wrong: 0.8, bet: 0.6, lose: 2.0, final: 2.4, win: 2.8, dare: 0.6, steal: 0.5, tick: 0.15, timeup: 0.8 };

/* ---------- the web game's music ---------- */
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const BPM = 132, BEAT = 60 / BPM, SWING = 0.62;
const LEAD = [
  [67, 0, 72, 0, 76, 0, 74, 72], [76, 0, 0, 72, 69, 0, 72, 0], [74, 0, 77, 0, 81, 0, 79, 77], [76, 0, 74, 0, 71, 0, 67, 0],
  [67, 0, 72, 0, 76, 0, 79, 0], [81, 0, 79, 76, 72, 0, 76, 0], [77, 0, 76, 0, 74, 0, 77, 81], [79, 0, 0, 0, 71, 0, 74, 0]
];
const BASS = [[36, 40, 43, 45], [33, 36, 40, 43], [38, 41, 45, 48], [31, 35, 38, 41]];
const CHORDS = [[60, 64, 67], [57, 60, 64], [62, 65, 69], [59, 62, 65, 67]];

function musicKit(m) {
  const sr = m.sr;
  const env = (t, vol, dur, attack = 0.005) => new Param(0).set(0.0001, t).exp(vol, t + attack).exp(0.0001, t + dur);
  const osc = (type, f, t, dur, vol, lp) => m.osc(type, f, t, t + dur + 0.03, env(t, vol, dur), lp ? [new Biquad("lowpass", lp, 1, sr)] : []);
  // The web game loops a 0.25 s noise buffer for hits; plain white noise sounds the same.
  const hit = (t, type, freq, vol, dur) => m.noise(t, t + dur + 0.02, env(t, vol, dur, 0.002), [new Biquad(type, freq, 1, sr)]);
  const kick = (t) => m.osc("sine", new Param(140).set(140, t).exp(45, t + 0.12), t, t + 0.2, env(t, 0.9, 0.16, 0.002), []);
  const snare = (t) => { hit(t, "bandpass", 1900, 0.45, 0.13); osc("triangle", 190, t, 0.08, 0.25); };
  const hat = (t, open) => hit(t, "highpass", 8000, open ? 0.14 : 0.09, open ? 0.12 : 0.035);
  const brass = (n, t, dur) => {
    [0, 6].forEach((cents) => {
      const fl = new Biquad("lowpass", new Param(900).set(900, t).lin(2600, t + 0.05), 1, sr);
      m.osc("sawtooth", hz(n), t, t + dur + 0.03, env(t, 0.16, dur, 0.02), [fl], { detune: cents });
    });
  };
  return { env, osc, hit, kick, snare, hat, brass };
}

function renderMain(m) {
  const { osc, kick, snare, hat, brass } = musicKit(m);
  for (let step = 0; step < LEAD.length; step++) {
    const bar = step % LEAD.length, chord = bar % 4, t0 = step * BEAT * 4;
    for (let beat = 0; beat < 4; beat++) {
      const on = t0 + beat * BEAT, off = on + BEAT * SWING;
      if (beat % 2 === 0) kick(on); else snare(on);
      hat(on, false); hat(off, beat === 3);
      osc("triangle", hz(BASS[chord][beat]), on, BEAT * 0.85, 0.5, 900);
      if (beat === 1 || beat === 3) CHORDS[chord].forEach((n) => osc("square", hz(n), off, 0.12, 0.05, 1800));
      [LEAD[bar][beat * 2], LEAD[bar][beat * 2 + 1]].forEach((n, k) => {
        if (n) brass(n, k ? off : on, (k ? BEAT * (1 - SWING) : BEAT * SWING) * 0.95);
      });
    }
  }
  return LEAD.length * BEAT * 4;
}

function renderSuspense(m) {
  const sr = m.sr;
  const { env, osc, hit, kick } = musicKit(m);
  const SB = 60 / 96;
  const ROOTS = [45, 41, 38, 40];
  const STRINGS = [[69, 72, 76], [65, 69, 72], [62, 65, 69], [64, 68, 71]];
  const tremolo = (n, t, dur) => {
    // saw -> lowpass 1700 -> gain (0.5 + 0.5 * 9 Hz LFO) -> envelope
    m.osc("sawtooth", hz(n), t, t + dur + 0.05, env(t, 0.05, dur, 0.4), [new Biquad("lowpass", 1700, 1, sr)],
      { post: (tt, x) => x * (0.5 + 0.5 * Math.sin(2 * Math.PI * 9 * (tt - t))) });
  };
  for (let step = 0; step < 4; step++) {
    const c = step % 4, t0 = step * SB * 4;
    STRINGS[c].forEach((n) => tremolo(n, t0, SB * 4));
    for (let beat = 0; beat < 4; beat++) {
      const on = t0 + beat * SB;
      if (beat === 0 || beat === 2) { kick(on); kick(on + 0.2); }
      hit(on, "highpass", 6000, 0.08, 0.03);
      for (let e = 0; e < 2; e++) osc("triangle", hz(ROOTS[c]), on + e * SB / 2, SB * 0.4, 0.38, 500);
    }
  }
  return 4 * SB * 4;
}

/* ---------- master: gain 1.9 -> limiter (threshold -8 dB, ratio 12, attack 3 ms, release 200 ms) ---------- */
function master(buf, sr, preGain, loop = false) {
  const thr = -8, knee = 6, ratio = 12;
  const att = Math.exp(-1 / (0.003 * sr)), rel = Math.exp(-1 / (0.2 * sr));
  const makeup = 1.55;   // ≈ the automatic makeup gain Web Audio's compressor adds with these settings
  let envDb = -120;
  const gainFor = (x) => {
    const db = 20 * Math.log10(Math.abs(x) + 1e-9);
    envDb = db > envDb ? att * envDb + (1 - att) * db : rel * envDb + (1 - rel) * db;
    let over = envDb - thr, red = 0;
    if (over > knee / 2) red = over * (1 - 1 / ratio);
    else if (over > -knee / 2) red = (1 - 1 / ratio) * Math.pow(over + knee / 2, 2) / (2 * knee);
    return Math.pow(10, -red / 20);
  };
  // For loops, warm the detector up on the end of the loop first so the seam matches.
  if (loop) for (let s = Math.max(0, buf.length - sr); s < buf.length; s++) gainFor(buf[s] * preGain);
  const out = new Float64Array(buf.length);
  for (let s = 0; s < buf.length; s++) {
    const x = buf[s] * preGain;
    const y = x * gainFor(x) * makeup;
    out[s] = Math.tanh(y * 1.05) / 1.05 * 0.98;   // gentle safety clip
  }
  return out;
}

function wav(samples, sr) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}

let total = 0;
function save(name, samples, sr) {
  const data = wav(samples, sr);
  writeFileSync(join(outDir, name + ".wav"), data);
  total += data.length;
  let peak = 0; for (const x of samples) peak = Math.max(peak, Math.abs(x));
  console.log(`${(name + ".wav").padEnd(16)} ${(samples.length / sr).toFixed(2)} s  ${String(Math.round(data.length / 1024)).padStart(4)} KB  peak ${peak.toFixed(2)}`);
}

/* ---------- render ---------- */
const SFX_SR = 44100;
let seed = 7;
for (const [name, len] of Object.entries(SFX_LENGTH)) {
  const m = new Mix(len, SFX_SR, seed++);
  makeSfx(m)[name]();
  // trim trailing silence
  const out = master(m.buf, SFX_SR, 1.9);
  let end = out.length;
  while (end > 1 && Math.abs(out[end - 1]) < 1e-4) end--;
  save("sfx-" + name, out.subarray(0, Math.min(out.length, end + Math.round(0.01 * SFX_SR))), SFX_SR);
}

// Music: render one full cycle plus a tail, then wrap the tail onto the start so it loops seamlessly.
const MUSIC_SR = 32000;
for (const [name, fn] of [["music-main", renderMain], ["music-suspense", renderSuspense]]) {
  const m = new Mix(20, MUSIC_SR, seed++);
  const loopLen = Math.round(fn(m) * MUSIC_SR);
  const loop = new Float64Array(loopLen);
  for (let s = 0; s < m.buf.length; s++) loop[s % loopLen] += m.buf[s];
  save(name, master(loop, MUSIC_SR, 0.14 * 1.9, true), MUSIC_SR);
}
console.log(`total ${Math.round(total / 1024)} KB in assets/audio/`);
