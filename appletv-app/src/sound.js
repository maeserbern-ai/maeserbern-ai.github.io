// Sound effects + music for tvOS. The web game synthesizes them live with Web Audio;
// tvOS has no Web Audio, so scripts/render-audio.mjs pre-renders the same recipes
// into assets/audio/*.wav and expo-audio plays them. Sound is always optional:
// every call is wrapped so a playback problem can never break the game.
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

const SFX_FILES = {
  move: require("../assets/audio/sfx-move.wav"),
  click: require("../assets/audio/sfx-click.wav"),
  reveal: require("../assets/audio/sfx-reveal.wav"),
  help: require("../assets/audio/sfx-help.wav"),
  correct: require("../assets/audio/sfx-correct.wav"),
  wrong: require("../assets/audio/sfx-wrong.wav"),
  bet: require("../assets/audio/sfx-bet.wav"),
  lose: require("../assets/audio/sfx-lose.wav"),
  final: require("../assets/audio/sfx-final.wav"),
  win: require("../assets/audio/sfx-win.wav"),
  dare: require("../assets/audio/sfx-dare.wav"),
  steal: require("../assets/audio/sfx-steal.wav"),
  tick: require("../assets/audio/sfx-tick.wav"),
  timeup: require("../assets/audio/sfx-timeup.wav")
};
const MUSIC_FILES = {
  main: require("../assets/audio/music-main.wav"),
  suspense: require("../assets/audio/music-suspense.wav")
};

const players = {};
const music = {};
let musicMode = null;
let ready = false;

export function initAudio() {
  if (ready) return;
  ready = true;
  try { setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); } catch (e) { /* optional */ }
  for (const [name, src] of Object.entries(SFX_FILES)) {
    try { players[name] = createAudioPlayer(src); } catch (e) { /* optional */ }
  }
  for (const [name, src] of Object.entries(MUSIC_FILES)) {
    try { const p = createAudioPlayer(src); p.loop = true; music[name] = p; } catch (e) { /* optional */ }
  }
}

export function playSfx(name) {
  const p = players[name];
  if (!p) return;
  try {
    const r = p.seekTo(0);
    p.play();
    if (r && r.catch) r.catch(() => {});
  } catch (e) { /* sound is optional */ }
}

export function startMusic(mode) {
  if (musicMode === mode) return;
  stopMusic();
  const p = music[mode];
  if (!p) return;
  musicMode = mode;
  try {
    const r = p.seekTo(0);
    if (r && r.catch) r.catch(() => {});
    p.play();
  } catch (e) { musicMode = null; }
}

export function stopMusic() {
  if (!musicMode) return;
  const p = music[musicMode];
  musicMode = null;
  try { p.pause(); } catch (e) { /* ignore */ }
}

export const currentMusic = () => musicMode;
