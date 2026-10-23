import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const destination = fileURLToPath(new URL('../assets/fonts/', import.meta.url));
mkdirSync(destination, { recursive: true });
const url = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Inter:wght@500;700;800&display=swap';
const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' } });
if (!response.ok) throw new Error(`Font CSS download: ${response.status}`);
let css = await response.text();
const fonts = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(match => match[1]))];
if (!fonts.length) throw new Error('No fonts found in Google Fonts response');
for (const [index, font] of fonts.entries()) {
  const result = await fetch(font);
  if (!result.ok) throw new Error(`Font download: ${result.status}`);
  const name = `font-${index}.${font.endsWith('.woff2') ? 'woff2' : 'ttf'}`;
  writeFileSync(`${destination}${name}`, Buffer.from(await result.arrayBuffer()));
  css = css.split(font).join(name);
}
writeFileSync(`${destination}fonts.css`, css);
for (const family of ['fraunces', 'inter']) {
  const result = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`);
  if (!result.ok) throw new Error(`Font license download: ${result.status}`);
  writeFileSync(`${destination}${family}-OFL.txt`, await result.text());
}
console.log(`Saved ${fonts.length} font files and both font licenses.`);
