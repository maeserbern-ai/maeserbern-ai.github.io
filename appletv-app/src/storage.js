// Small on-device memory (sound/music choice, puzzles already shown), like the web
// game's localStorage. Uses React Native's built-in Settings module (NSUserDefaults),
// which works on tvOS with no extra native code. Everything is optional.
import { Settings } from "react-native";

export function load(key, fallback) {
  try {
    const v = Settings.get(key);
    return v === undefined || v === null ? fallback : v;
  } catch (e) { return fallback; }
}

export function save(key, value) {
  try { Settings.set({ [key]: value }); } catch (e) { /* storage is optional */ }
}
