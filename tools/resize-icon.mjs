#!/usr/bin/env node
// ─── İkon küçültücü ─────────────────────────────────────────────────────────
//
// Kullanım:  node apk_web/tools/resize-icon.mjs
// Girdi    : lib/assets/uygulamaicon.png (1254x1254 / ~1.7 MB)
// Çıktı    : apk_web/assets/icon-512.png, icon-192.png, icon-64.png
//
// Neden: indirme sayfası mobilde açılıyor; hero görselinin 1.7 MB olması
// gereksiz. Yalnız Node standart kütüphanesi kullanılır (harici paket yok):
// PNG çözülür, kutu ortalamasıyla küçültülür, yeniden kodlanır.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'lib', 'assets', 'uygulamaicon.png');
const OUT_DIR = join(ROOT, 'apk_web', 'assets');
const SIZES = [512, 256, 192, 64];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, body, crc]);
}

function decodePng(path) {
  const data = readFileSync(path);
  if (data.subarray(0, 8).toString('latin1') !== '\x89PNG\r\n\x1a\n') {
    throw new Error('PNG değil: ' + path);
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let colourType = 0;
  const idat = [];
  while (pos < data.length) {
    const len = data.readUInt32BE(pos);
    const type = data.subarray(pos + 4, pos + 8).toString('latin1');
    const body = data.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      colourType = body[9];
      const interlace = body[12];
      if (depth !== 8 || (colourType !== 2 && colourType !== 6) || interlace !== 0) {
        throw new Error(`desteklenmeyen PNG: bit=${depth} tip=${colourType} interlace=${interlace}`);
      }
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(body));
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const ch = colourType === 6 ? 4 : 3;
  const stride = width * ch;
  const px = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = px.subarray(y * stride, (y + 1) * stride);
    raw.copy(line, 0, p, p + stride);
    p += stride;
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= ch ? prev[i - ch] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      if (add !== 0) line[i] = (line[i] + add) & 255;
    }
  }
  return { width, height, ch, px };
}

/** Kutu ortalaması: her hedef piksel, kaynaktaki bloğunun ortalamasıdır. */
function resize({ width, height, ch, px }, nw) {
  const nh = nw;
  const out = Buffer.alloc(nw * nh * ch);
  for (let dy = 0; dy < nh; dy++) {
    const y0 = Math.floor((dy * height) / nh);
    const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * height) / nh));
    for (let dx = 0; dx < nw; dx++) {
      const x0 = Math.floor((dx * width) / nw);
      const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * width) / nw));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        const base = sy * width * ch;
        for (let sx = x0; sx < x1; sx++) {
          const i = base + sx * ch;
          r += px[i];
          g += px[i + 1];
          b += px[i + 2];
          if (ch === 4) a += px[i + 3];
          n++;
        }
      }
      const di = (dy * nw + dx) * ch;
      out[di] = Math.floor(r / n);
      out[di + 1] = Math.floor(g / n);
      out[di + 2] = Math.floor(b / n);
      if (ch === 4) out[di + 3] = Math.floor(a / n);
    }
  }
  return out;
}

function encodePng(width, height, ch, px) {
  const stride = width * ch;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtre yok
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = ch === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const src = decodePng(SRC);
console.log(`kaynak ${src.width}x${src.height} kanal=${src.ch}`);
mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = encodePng(size, size, src.ch, resize(src, size));
  const path = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`${relative(ROOT, path)}  ${size}x${size}  ${(png.length / 1024).toFixed(0)} KB`);
}
