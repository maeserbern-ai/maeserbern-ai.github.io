import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './store-client.mjs';

const source = fs.readFileSync(path.join(ROOT, 'game-html.js'), 'utf8');
const html = JSON.parse(source.slice(source.indexOf('export default ') + 15).trim().replace(/;$/, ''));
const server = http.createServer((req, res) => {
  if (req.url !== '/') {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
});
server.listen(8107, '127.0.0.1', () => console.log('Bundled iOS game preview: http://127.0.0.1:8107/'));
