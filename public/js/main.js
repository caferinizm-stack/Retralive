// ─── İndirme sayfası mantığı ───────────────────────────────────────────────
//
// Akış:
//   1) `site_apk_page` çağrılır → yayındaki APK + sayfa metinleri gelir.
//   2) Başlık, alt başlık, sürüm/boyut/tarih rozetleri ve "Yenilikler" yazılır.
//   3) "İndir" basılınca sayaç artar (`site_apk_hit`) ve dosya indirilir.
//      APK parçalıysa (`multi|url1|url2…`) parçalar sırayla indirilip
//      tarayıcıda birleştirilir; ilerleme yüzdesi gösterilir.
//   4) Sayfa 45 sn'de bir ve öne geldiğinde kendini tazeler: admin sürümü
//      değiştirdiği an indirme düğmesi yeni sürüme geçer.
//
// `?demo=1` → ağa çıkmadan örnek veriyle görünüm denenir.

import {
  DEMO_PAGE,
  FEATURES,
  POLL_MS,
  STEPS,
  SUPABASE,
  fileName,
} from './config.js';

const $ = (id) => document.getElementById(id);
const DEMO = new URLSearchParams(location.search).has('demo');
const MIME = 'application/vnd.android.package-archive';
const MULTI_PREFIX = 'multi|';

const state = {
  status: 'loading', // loading | ready | empty | error
  release: null,
  settings: {},
  downloadsTotal: 0,
  busy: false,
};

// ── Biçimlendirme ──────────────────────────────────────────────────────────

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '—';
  const mb = n / 1048576;
  if (mb < 1) return `${(n / 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatNumber(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('tr-TR');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const two = (x) => String(x).padStart(2, '0');
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function versionLabel(release) {
  if (!release) return 'APK';
  const name = (release.version_name || '').trim();
  const code = Number(release.version_code || 0);
  if (name && code > 0) return `${name} (${code})`;
  return name || (code > 0 ? `v${code}` : 'APK');
}

/** `multi|url1|url2` → [url1, url2] (tek adreste tek elemanlı liste). */
function partUrls(url) {
  const raw = (url || '').trim();
  if (!raw) return [];
  if (!raw.startsWith(MULTI_PREFIX)) return [raw];
  return raw
    .slice(MULTI_PREFIX.length)
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
}

// ── Sunucu ─────────────────────────────────────────────────────────────────

async function fetchPage() {
  if (DEMO) return DEMO_PAGE;
  const res = await fetch(`${SUPABASE.url}/rest/v1/rpc/site_apk_page`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE.anonKey,
      Authorization: `Bearer ${SUPABASE.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (res.status === 404) {
    throw new Error(
      'Sunucuda indirme sayfası kurulu değil (supabase_site_apk.sql çalıştırılmalı).',
    );
  }
  if (!res.ok) throw new Error(`Sunucu yanıtı: ${res.status}`);
  const data = await res.json();
  if (!data || data.ok !== true) throw new Error('Sunucu yanıtı okunamadı.');
  return data;
}

/** İndirme sayacı — hata olsa bile indirme devam eder. */
function countDownload() {
  if (DEMO) return;
  fetch(`${SUPABASE.url}/rest/v1/rpc/site_apk_hit`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE.anonKey,
      Authorization: `Bearer ${SUPABASE.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  }).catch(() => {});
}

// ── Görünüm ────────────────────────────────────────────────────────────────

function setState(kind, text) {
  const box = $('state');
  box.className = `state show${kind === 'loading' ? '' : ` ${kind}`}`;
  box.replaceChildren();
  if (kind === 'loading') {
    const spin = document.createElement('span');
    spin.className = 'spinner';
    spin.setAttribute('aria-hidden', 'true');
    box.appendChild(spin);
  }
  const span = document.createElement('span');
  span.id = 'state-text';
  span.textContent = text;
  box.appendChild(span);
  if (kind === 'error') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-sm';
    retry.textContent = 'Tekrar dene';
    retry.addEventListener('click', () => load({ silent: true }));
    box.appendChild(retry);
  }
}

function hideState() {
  $('state').className = 'state';
  $('state').replaceChildren();
}

function showProgress(show) {
  $('progress').hidden = !show;
  if (!show) {
    $('progress-bar').style.width = '0%';
    $('progress-text').textContent = '';
  }
}

function setProgress(pct, text) {
  showProgress(true);
  const safe = Math.max(0, Math.min(100, Number(pct) || 0));
  $('progress-bar').style.width = `${safe}%`;
  $('progress-text').textContent = text || '';
}

function renderFeatures() {
  const list = $('features');
  list.replaceChildren();
  for (const f of FEATURES) {
    const item = document.createElement('div');
    item.className = 'feature';
    const ico = document.createElement('span');
    ico.className = 'ico';
    ico.textContent = f.icon;
    const body = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = f.title;
    const text = document.createElement('span');
    text.textContent = f.text;
    body.append(title, text);
    item.append(ico, body);
    list.appendChild(item);
  }
}

function renderSteps() {
  const list = $('steps');
  list.replaceChildren();
  for (const s of STEPS) {
    const li = document.createElement('li');
    li.textContent = s;
    list.appendChild(li);
  }
}

function render() {
  const release = state.release;
  const settings = state.settings || {};

  if (settings.headline) $('headline').textContent = settings.headline;
  if (settings.subtitle) $('subtitle').textContent = settings.subtitle;

  const notice = (settings.notice || '').trim();
  $('notice').hidden = !notice;
  $('notice').textContent = notice;

  if (state.status === 'ready' && release) {
    $('badge-version').replaceChildren();
    const dot = document.createElement('span');
    dot.className = 'dot';
    $('badge-version').append(dot, document.createTextNode(` Sürüm ${versionLabel(release)}`));
    $('badge-size').textContent = `Boyut ${formatBytes(release.size_bytes)}`;
    $('badge-date').textContent = `Tarih ${formatDate(release.created_at)}`;

    $('download').disabled = false;
    $('download-sticky').disabled = false;
    $('download-label').textContent =
      Number(release.size_bytes) > 0
        ? `${formatBytes(release.size_bytes)} · APK’yı indir`
        : 'APK’yı indir';
    $('downloads-note').textContent = `${formatNumber(release.downloads || 0)} kez indirildi`;

    const note = (release.note || '').trim();
    $('whatsnew').hidden = !note;
    $('note').textContent = note;

    $('sticky').hidden = false;
    $('sticky-version').textContent = `Sürüm ${versionLabel(release)}`;
    $('sticky-size').textContent = `${formatBytes(release.size_bytes)} · ${formatNumber(
      release.downloads || 0,
    )} indirme`;

    hideState();
  } else if (state.status === 'empty') {
    $('badge-version').textContent = 'Sürüm —';
    $('badge-size').textContent = 'Boyut —';
    $('badge-date').textContent = 'Tarih —';
    $('download').disabled = true;
    $('download-sticky').disabled = true;
    $('download-label').textContent = 'APK henüz yayınlanmadı';
    $('downloads-note').textContent = '';
    $('whatsnew').hidden = true;
    $('sticky').hidden = true;
    setState('empty', 'İndirme dosyası henüz yayınlanmadı. Kısa süre sonra tekrar bak.');
  } else if (state.status === 'error') {
    $('badge-version').textContent = 'Sürüm —';
    $('badge-size').textContent = 'Boyut —';
    $('badge-date').textContent = 'Tarih —';
    $('download').disabled = true;
    $('download-sticky').disabled = true;
    $('download-label').textContent = 'APK’yı indir';
    $('downloads-note').textContent = '';
    $('sticky').hidden = true;
    setState('error', state.error || 'Sunucuya bağlanamadı.');
  } else {
    $('download').disabled = true;
    $('download-sticky').disabled = true;
    setState('loading', 'Sunucuya bağlanılıyor…');
  }
}

// ── Veri yükleme ───────────────────────────────────────────────────────────

async function load({ silent = false } = {}) {
  if (state.busy) return;
  if (!silent) {
    state.status = 'loading';
    render();
  }
  try {
    const data = await fetchPage();
    state.release = data.release || null;
    state.settings = data.settings || {};
    state.downloadsTotal = Number(data.downloads_total || 0);
    state.status = state.release && state.release.url ? 'ready' : 'empty';
  } catch (err) {
    state.error = err?.message || 'Sunucuya bağlanamadı.';
    // Elde sürüm varsa sayfayı boşaltma; yalnız sessiz tazelemede eski veri kalsın.
    state.status = state.release ? 'ready' : 'error';
    if (state.status === 'error') {
      state.release = null;
    }
  }
  render();
}

// ── İndirme ────────────────────────────────────────────────────────────────

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function triggerDirect(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Parçalı APK: parçalar sırayla indirilir, tarayıcıda birleştirilir. */
async function downloadParts(parts, release) {
  const chunks = [];
  let received = 0;
  const expected = Number(release.size_bytes || 0);
  for (let i = 0; i < parts.length; i++) {
    const res = await fetch(parts[i], { mode: 'cors' });
    if (!res.ok) throw new Error(`parça ${i + 1} indirilemedi (${res.status}).`);
    const reader = res.body?.getReader?.();
    if (!reader) {
      const buf = await res.arrayBuffer();
      chunks.push(buf);
      received += buf.byteLength;
      continue;
    }
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const pct = expected > 0 ? Math.min(99, (received / expected) * 100) : 0;
      setProgress(
        pct,
        expected > 0
          ? `İndiriliyor %${pct.toFixed(0)} · ${formatBytes(received)} / ${formatBytes(expected)}`
          : `İndiriliyor · ${formatBytes(received)}`,
      );
    }
  }
  const blob = new Blob(chunks, { type: MIME });
  saveBlob(blob, fileName(release));
  setProgress(100, `İndirme tamamlandı · ${formatBytes(blob.size)}`);
  setTimeout(() => showProgress(false), 6000);
}

async function startDownload() {
  const release = state.release;
  if (!release || state.busy || state.status !== 'ready') return;
  if (DEMO) {
    setState('loading', 'Demo görünüm: gerçek indirme, site yayına alındığında çalışır.');
    setTimeout(() => hideState(), 4000);
    return;
  }
  state.busy = true;
  $('download').disabled = true;
  $('download-sticky').disabled = true;
  countDownload();
  state.release = { ...release, downloads: Number(release.downloads || 0) + 1 };
  $('downloads-note').textContent = `${formatNumber(state.release.downloads)} kez indirildi`;
  const parts = partUrls(release.url);
  try {
    if (parts.length === 1) {
      // Tek dosya: akışla indirilir (yüzde gösterilir). Tarayıcı akışa izin
      // vermezse doğrudan bağlantıya düşülür — indirme yine başlar.
      try {
        await downloadParts(parts, release);
      } catch (err) {
        triggerDirect(parts[0], fileName(release));
        setState('loading', 'Dosya doğrudan indiriliyor — bildirim çubuğundan takip et.');
        setTimeout(() => hideState(), 5000);
      }
    } else {
      setState('loading', `${parts.length} parça indirilip birleştirilecek…`);
      await downloadParts(parts, release);
      setTimeout(() => hideState(), 5000);
    }
  } catch (err) {
    showProgress(false);
    setState(
      'error',
      `İndirme başlatılamadı: ${err?.message || err}. İlk parçayı doğrudan açmak için dokun.`,
    );
    const box = $('state');
    if (parts[0]) {
      const link = document.createElement('a');
      link.href = parts[0];
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Parçayı aç';
      link.className = 'btn btn-sm';
      link.style.textDecoration = 'none';
      box.appendChild(link);
    }
  } finally {
    state.busy = false;
    $('download').disabled = !state.release;
    $('download-sticky').disabled = !state.release;
  }
}

// ── Başlangıç ──────────────────────────────────────────────────────────────

function bind() {
  $('download').addEventListener('click', startDownload);
  $('download-sticky').addEventListener('click', startDownload);
  $('year').textContent = String(new Date().getFullYear());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !state.busy) load({ silent: true });
  });
  setInterval(() => {
    if (!document.hidden && !state.busy) load({ silent: true });
  }, POLL_MS);
}

renderFeatures();
renderSteps();
bind();
load();
