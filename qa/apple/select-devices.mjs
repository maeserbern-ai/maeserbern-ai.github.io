import fs from 'node:fs';
const [input, platform] = process.argv.slice(2);
const devices = Object.entries(JSON.parse(fs.readFileSync(input, 'utf8')).devices)
  .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
  .flatMap(([runtime, list]) => list.filter(d => d.isAvailable).map(d => ({ ...d, runtime })));
const selected = [];
function pick(tag, patterns) {
  const device = patterns.map(re => devices.find(d => re.test(d.name) && d.runtime.includes(platform === 'tvos' ? '.tvOS-' : '.iOS-'))).find(Boolean);
  if (!device) throw new Error(`No simulator available for ${tag}`);
  selected.push({ tag, ...device });
}
if (platform === 'tvos') {
  pick('apple-tv', [/Apple TV.*1080p/i, /^Apple TV$/]);
} else {
  pick('iphone', [/^iPhone 16 Pro Max$/, /^iPhone 17 Pro Max$/, /iPhone.*Pro Max/]);
  pick('ipad', [/iPad Pro 13-inch/, /iPad Pro.*12.9/]);
  const duo = devices.find(d => /Duo/i.test(d.name) && d.runtime.includes('.iOS-'));
  if (duo) selected.push({ tag: 'duo', ...duo });
}
fs.writeFileSync('qa-output/devices-selected.json', JSON.stringify(selected, null, 2));
for (const d of selected) console.log(`${d.tag}\t${d.udid}\t${d.name}`);
