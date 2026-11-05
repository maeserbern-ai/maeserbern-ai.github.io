// Runs the Expo CLI with EXPO_TV=1 on any shell (Windows PowerShell has no `VAR=1 cmd`).
//   node scripts/expo-tv.mjs config --type public
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cli = require.resolve("expo/bin/cli");
const r = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, EXPO_TV: "1" } });
process.exit(r.status ?? 1);
