/* Renders the web game's synthesized sound effects and music to audio files
   for the Roku channel (Roku can't synthesize Web Audio, so we bake it).

   The synth code below is copied from party-game/game.js (tone, noise, SFX,
   startMusic, startSuspense) and pointed at an OfflineAudioContext.

   Run (needs node-web-audio-api; ffmpeg on PATH for the MP3 music loops):
     npm install --no-save node-web-audio-api
     node roku-channel/tools/render-audio.mjs
*/
import { OfflineAudioContext } from "node-web-audio-api";
import { writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OUT = process.env.ROKU_SOUNDS_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "sounds");
const RATE = 44100;

function wav(samples, rate) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buf;
}

// Same master chain as the web game: gain 1.9 into a limiter.
function makeCtx(seconds) {
  const a = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
  const master = a.createGain();
  master.gain.value = 1.9;
  const limiter = a.createDynamicsCompressor();
  limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 12;
  limiter.attack.value = 0.003; limiter.release.value = 0.2;
  master.connect(limiter); limiter.connect(a.destination);
  return { a, master };
}

function synth(a, master) {
  function tone(freq, at, dur, type = "triangle", vol = 0.3, opts = {}) {
    const t = a.currentTime + at;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    if (Array.isArray(freq)) {
      o.frequency.setValueAtTime(freq[0], t);
      o.frequency.exponentialRampToValueAtTime(freq[1], t + dur);
    } else o.frequency.setValueAtTime(freq, t);
    if (opts.vibrato) {
      const lfo = a.createOscillator(), lg = a.createGain();
      lfo.frequency.value = opts.vibrato; lg.gain.value = 8;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opts.lowpass) {
      const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = opts.lowpass;
      node.connect(f); node = f;
    }
    node.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(at, dur, freq, vol = 0.2, type = "bandpass", q = 1) {
    const t = a.currentTime + at;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.9); src.stop(t + dur + 0.02);
  }
  const SFX = {
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
    applause(at = 0, len = 2.2) { for (let t = 0; t < len; t += 0.024) noise(at + t + Math.random() * 0.012, 0.045, 1500 + Math.random() * 2500, 0.08 * (1 - t / len) + 0.014); },
    final()   { SFX.drumroll(0.9); SFX.fanfare(1.0); },
    win()     { SFX.fanfare(0); SFX.applause(0.4); },
    dare()    { tone([660, 520], 0, 0.18, "sine", 0.2); tone([520, 330], 0.2, 0.3, "sine", 0.2); },
    steal()   { [784, 988, 1175].forEach((f, i) => tone(f, 0.25 + i * 0.07, 0.14, "square", 0.1, { lowpass: 3000 })); },
    tick()    { tone(1760, 0, 0.06, "square", 0.08, { lowpass: 3000 }); },
    timeup()  { tone(880, 0, 0.12, "square", 0.14, { lowpass: 2500 }); tone(880, 0.16, 0.12, "square", 0.14, { lowpass: 2500 }); tone(880, 0.32, 0.4, "square", 0.14, { lowpass: 2500 }); }
  };
  return SFX;
}

// How long each effect needs (its longest note + tail).
const LENGTHS = { move: 0.12, click: 0.15, reveal: 0.2, help: 0.3, correct: 0.6, wrong: 0.8, bet: 0.6, lose: 2.0,
  final: 2.5, win: 2.8, dare: 0.6, steal: 0.6, tick: 0.12, timeup: 0.8 };

async function renderSfx(name) {
  const { a, master } = makeCtx(LENGTHS[name]);
  synth(a, master)[name]();
  const buf = await a.startRendering();
  writeFileSync(path.join(OUT, name + ".wav"), wav(buf.getChannelData(0), RATE));
}

/* ---------- music (copied from startMusic / startSuspense) ---------- */
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const LEAD = [
  [67, 0, 72, 0, 76, 0, 74, 72], [76, 0, 0, 72, 69, 0, 72, 0], [74, 0, 77, 0, 81, 0, 79, 77], [76, 0, 74, 0, 71, 0, 67, 0],
  [67, 0, 72, 0, 76, 0, 79, 0], [81, 0, 79, 76, 72, 0, 76, 0], [77, 0, 76, 0, 74, 0, 77, 81], [79, 0, 0, 0, 71, 0, 74, 0]
];
const BASS = [[36, 40, 43, 45], [33, 36, 40, 43], [38, 41, 45, 48], [31, 35, 38, 41]];
const CHORDS = [[60, 64, 67], [57, 60, 64], [62, 65, 69], [59, 62, 65, 67]];

function instruments(a, master) {
  const bus = a.createGain();
  bus.gain.value = 0.14;
  bus.connect(master);
  const env = (node, t, vol, dur, attack = 0.005) => {
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(bus);
  };
  const osc = (type, f, t, dur, vol, lp) => {
    const o = a.createOscillator(); o.type = type; o.frequency.value = f;
    let n = o;
    if (lp) { const fl = a.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; o.connect(fl); n = fl; }
    env(n, t, vol, dur); o.start(t); o.stop(t + dur + 0.03);
  };
  const nb = (() => { const len = a.sampleRate * 0.25, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const hit = (t, type, freq, vol, dur) => {
    const src = a.createBufferSource(), f = a.createBiquadFilter();
    src.buffer = nb; f.type = type; f.frequency.value = freq;
    src.connect(f); env(f, t, vol, dur, 0.002); src.start(t); src.stop(t + dur + 0.02);
  };
  const kick = (t) => { const o = a.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); env(o, t, 0.9, 0.16, 0.002); o.start(t); o.stop(t + 0.2); };
  const snare = (t) => { hit(t, "bandpass", 1900, 0.45, 0.13); osc("triangle", 190, t, 0.08, 0.25); };
  const hat = (t, open) => hit(t, "highpass", 8000, open ? 0.14 : 0.09, open ? 0.12 : 0.035);
  const brass = (n, t, dur) => {
    [0, 6].forEach((cents) => { const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(n); o.detune.value = cents;
      const fl = a.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(900, t); fl.frequency.linearRampToValueAtTime(2600, t + 0.05);
      o.connect(fl); env(fl, t, 0.16, dur, 0.02); o.start(t); o.stop(t + dur + 0.03); });
  };
  return { bus, env, osc, hit, kick, snare, hat, brass };
}

// Renders two full cycles and keeps the second, so the loop point already
// contains the tails of the previous cycle (seamless when it repeats).
async function renderTheme() {
  const BPM = 132, BEAT = 60 / BPM, SWING = 0.62, BAR = BEAT * 4, BARS = LEAD.length;
  const { a, master } = makeCtx(BAR * BARS * 2 + 0.5);
  const { osc, kick, snare, hat, brass } = instruments(a, master);
  for (let step = 0; step < BARS * 2; step++) {
    const bar = step % BARS, chord = bar % 4, t0 = step * BAR;
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
  const buf = await a.startRendering();
  return buf.getChannelData(0).slice(Math.round(BAR * BARS * RATE), Math.round(BAR * BARS * 2 * RATE));
}

async function renderSuspense() {
  const SB = 60 / 96, BAR = SB * 4, BARS = 4;
  const ROOTS = [45, 41, 38, 40];
  const STRINGS = [[69, 72, 76], [65, 69, 72], [62, 65, 69], [64, 68, 71]];
  const { a, master } = makeCtx(BAR * BARS * 2 + 0.5);
  const { env, osc, hit, kick } = instruments(a, master);
  const tremolo = (n, t, dur) => {
    const o = a.createOscillator(), trem = a.createGain(), lfo = a.createOscillator(), depth = a.createGain(), fl = a.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.value = hz(n);
    fl.type = "lowpass"; fl.frequency.value = 1700;
    trem.gain.value = 0.5; lfo.frequency.value = 9; depth.gain.value = 0.5;
    lfo.connect(depth); depth.connect(trem.gain);
    o.connect(fl); fl.connect(trem); env(trem, t, 0.05, dur, 0.4);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  };
  for (let step = 0; step < BARS * 2; step++) {
    const c = step % 4, t0 = step * BAR;
    STRINGS[c].forEach((n) => tremolo(n, t0, SB * 4));
    for (let beat = 0; beat < 4; beat++) {
      const on = t0 + beat * SB;
      if (beat === 0 || beat === 2) { kick(on); kick(on + 0.2); }
      hit(on, "highpass", 6000, 0.08, 0.03);
      for (let e = 0; e < 2; e++) osc("triangle", hz(ROOTS[c]), on + e * SB / 2, SB * 0.4, 0.38, 500);
    }
  }
  const buf = await a.startRendering();
  return buf.getChannelData(0).slice(Math.round(BAR * BARS * RATE), Math.round(BAR * BARS * 2 * RATE));
}

function toMp3(samples, name) {
  const tmp = path.join(OUT, name + ".tmp.wav");
  writeFileSync(tmp, wav(samples, RATE));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-ac", "1", "-ar", "44100", "-b:a", "96k", path.join(OUT, name + ".mp3")]);
  unlinkSync(tmp);
}

for (const name of Object.keys(LENGTHS)) await renderSfx(name);
toMp3(await renderTheme(), "theme");
toMp3(await renderSuspense(), "suspense");
console.log("rendered", Object.keys(LENGTHS).length, "effects + theme.mp3 + suspense.mp3 into", OUT);
