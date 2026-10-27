// ─── Statik içerik görevlisi (Sites / Cloudflare Workers) ───────────────────
//
// Sayfa tek dosyalık bir vitrindir: sunucu tarafı mantık yoktur, veri
// Supabase'ten tarayıcıdan okunur. Bu yüzden görevli yalnız statik dosyaları
// servis eder ve uzantısız yolları `index.html`e çevirir.
//
// Assets kök dizini `deploy.json` içinde `./public` olarak verilir;
// `node tools/build.mjs` bu dizini üretir.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // `/`, `/indir`, `/kurulum` gibi uzantısız yollar → index.html
    if (!url.pathname.includes('.')) {
      const target = new URL(url);
      target.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(target, request));
    }
    return env.ASSETS.fetch(request);
  },
};
