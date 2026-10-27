#!/usr/bin/env node
// ─── Yerel geliştirme sunucusu ─────────────────────────────────────────────
//
// Kullanım:  node apk_web/tools/serve.mjs        (varsayılan port 5199)
//            PORT=5300 node apk_web/tools/serve.mjs
//
// Bağımlılık yok. Uzantısız yollar `index.html`e düşer (Worker ile aynı
// davranış). Sayfa Supabase'e canlı bağlanır; ağ olmadan görünüm denemek için
// `http://127.0.0.1:5199/?demo=1` adresini aç.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Ortamda PORT boş/0 gelirse varsayılana düşülür (aksi hâlde rastgele port açılır).
const wanted = Number(process.env.PORT);
const PORT = Number.isFinite(wanted) && wanted > 0 ? wanted : 5199;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path === '/' || path === '') path = '/index.html';

  const relative = normalize(path).replace(/^([/\\])+/, '');
  const file = join(ROOT, relative);

  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('403');
    return;
  }

  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch {
    try {
      const data = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(404).end('404');
    }
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`APK indirme sayfası: http://127.0.0.1:${PORT}/`);
  console.log(`Örnek görünüm:      http://127.0.0.1:${PORT}/?demo=1`);
});
