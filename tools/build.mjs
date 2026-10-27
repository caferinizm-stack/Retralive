#!/usr/bin/env node
// ─── Dağıtım paketi ────────────────────────────────────────────────────────
//
// Kullanım:  node apk_web/tools/build.mjs
// Çıktı    : apk_web/public/  (index.html, manifest.json, css/, js/, assets/)
//
// `deploy.json` bu dizini varlık kökü olarak gösterir. Yalnız herkese açık
// dosyalar kopyalanır: araç scriptleri (`tools/`), README ve kaynak ikon
// pakete girmez. GitHub Pages gibi statik barındırmalarda `public/` içeriği
// doğrudan yüklenebilir.

import { cpSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');
const ITEMS = ['index.html', 'manifest.json', 'css', 'js', 'assets'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const item of ITEMS) {
  cpSync(join(ROOT, item), join(OUT, item), { recursive: true });
}

let files = 0;
let bytes = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      files += 1;
      bytes += statSync(full).size;
    }
  }
}
walk(OUT);

console.log(
  `public/ hazır · ${files} dosya · ${(bytes / 1024 / 1024).toFixed(2)} MB`,
);
console.log(`dağıtım manifesti: ${relative(process.cwd(), join(ROOT, 'deploy.json'))}`);
