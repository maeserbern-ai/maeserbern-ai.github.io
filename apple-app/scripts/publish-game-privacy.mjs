import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const repo = 'maeserbern-ai/maeserbern-ai.github.io';
const endpoint = `repos/${repo}/contents/index.html`;
const previous = '<p><b>Ingredient Dictionary: The Party Game</b> collects nothing. It runs entirely on your TV or device, with no accounts and no tracking. It only remembers your sound and music settings on that device.</p>';
const replacement = '<p><b>Ingredient Party Game (Ingredient Dictionary: The Party Game)</b> does not collect or transmit personal data. It runs on your device with no accounts, analytics tools, or advertising trackers. Sound and music preferences and puzzle history are stored only on that device. The solo Apple Watch version also stores scores and streaks locally. These records are not sent to us or synced between devices. Optional book links and QR codes open external websites with their own privacy practices; buying a book never unlocks game content.</p>';
function api(path, input) {
  const args = ['api', path];
  if (input) args.push('--method', 'PUT', '--input', '-');
  return JSON.parse(execFileSync('gh', args, {
    encoding: 'utf8', input: input ? JSON.stringify(input) : undefined,
  }));
}
const current = api(`${endpoint}?ref=main`);
const original = Buffer.from(current.content, 'base64').toString('utf8');
if (original.includes(replacement)) throw new Error('Already updated; refusing a duplicate publication.');
if (original.split(previous).length !== 2) throw new Error('Expected exactly one original paragraph.');
const updated = original.replace(previous, replacement);
if (updated.replace(replacement, previous) !== original) throw new Error('Unrelated content would change.');
if (!process.argv.includes('--publish-approved-paragraph')) {
  console.log('Validated a single-paragraph change. No publication made.');
  process.exit(0);
}
const result = api(endpoint, {
  branch: 'main', sha: current.sha,
  message: 'Clarify Ingredient Party Game on-device records and optional book links',
  content: Buffer.from(updated).toString('base64'),
});
const readback = api(`${endpoint}?ref=${result.commit.sha}`);
if (Buffer.from(readback.content, 'base64').toString('utf8') !== updated) {
  throw new Error('Published file readback did not match expected contents.');
}
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/game-privacy-publication-20261019.json', JSON.stringify({
  commit: result.commit.sha, url: result.commit.html_url,
  sourceBlob: current.sha, publishedBlob: result.content.sha,
  onlyGameParagraphChanged: true, githubReadbackVerified: true,
  livePageVerified: false, publishedAt: new Date().toISOString(),
}, null, 2) + '\n');
console.log(JSON.stringify({ commit: result.commit.sha, url: result.commit.html_url, onlyGameParagraphChanged: true }));
