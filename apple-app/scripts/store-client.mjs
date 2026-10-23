import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const APP_ID = '6823244099';
export function storeClient({ allowWrites = false } = {}) {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8')).submit.production.ios;
  if (String(config.ascAppId) !== APP_ID) throw new Error('Wrong app configured');
  const key = fs.readFileSync(path.resolve(ROOT, config.ascApiKeyPath));
  const base = 'https://api.appstoreconnect.apple.com';
  function token() {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const input = `${encode({ alg: 'ES256', kid: config.ascApiKeyId, typ: 'JWT' })}.${encode({ iss: config.ascApiKeyIssuerId, iat: now - 30, exp: now + 900, aud: 'appstoreconnect-v1' })}`;
    return `${input}.${crypto.sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  }
  async function asc(endpoint, { method = 'GET', body } = {}) {
    const url = new URL(endpoint, base);
    if (url.origin !== base) throw new Error('Unexpected API host');
    if (method !== 'GET' && !allowWrites) throw new Error('Read-only mode');
    const result = await fetch(url, { method, signal: AbortSignal.timeout(45000), headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const raw = await result.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!result.ok) throw new Error(`${method} ${url.pathname}: ${data.errors?.map(e => `${e.code}: ${e.detail}`).join('; ') || result.status}`);
    return data;
  }
  async function all(endpoint) {
    const output = [];
    while (endpoint) {
      const result = await asc(endpoint);
      output.push(...result.data);
      endpoint = result.links?.next;
    }
    return output;
  }
  return { asc, all };
}
