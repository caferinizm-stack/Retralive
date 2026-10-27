# RETRA · APK indirme sayfası (web)

Uygulamanın Android APK'sını indirmek için web vitrini. Sayfa **girişsiz**
çalışır ve **hiçbir metin/dosya koda gömülü değildir**: yayındaki APK ve sayfa
metinleri Supabase'ten okunur, admin panelindeki **Site APK** ekranından
yönetilir.

```
Admin paneli (Site APK)                    Web (apk_web)
────────────────────────                   ──────────────
APK seç → yükle  ─┐
"Siteye al"     ──┼─► site_apk_releases ──► site_apk_page()  ──► index.html
Başlık/not yaz  ──┘   site_apk_settings      (girişsiz okuma)
                      ↑ indirme sayacı: site_apk_hit()
```

Bu özellik **uygulamanın APK güncellemesinden ayrıdır**: buradan yayınlanan APK
`app_releases` tablosuna yazılmaz, uygulama kullanıcılarına zorunlu güncelleme
penceresi çıkarmaz. İki sistem birbirini etkilemez.

## Dosya düzeni

| Yol | Ne işe yarar |
| --- | --- |
| `index.html` | Sayfa iskeleti (hero, indirme düğmesi, özellikler, kurulum, güvenlik) |
| `css/styles.css` | Koyu tema + neon tasarım (harici font/CDN yok) |
| `js/config.js` | Supabase bağlantısı, özellik/kurulum listeleri, demo verisi |
| `js/main.js` | Veri okuma, indirme, parçalı APK birleştirme, sayaç, 45 sn yoklama |
| `assets/icon-*.png` | Uygulama ikonu (512/256/192/64) — `lib/assets/uygulamaicon.png`ten üretilir |
| `worker.js`, `deploy.json` | Statik barındırma için Worker + dağıtım manifesti |
| `tools/serve.mjs` | Yerel sunucu (port 5199) |
| `tools/build.mjs` | `public/` dağıtım paketini üretir |
| `tools/resize-icon.mjs` | İkonu web boyutlarına indirir (Node, harici paket yok) |

## Kurulum (sırayla)

1. **SQL**: `supabase_site_apk.sql` dosyasını Supabase ▸ SQL Editor'de çalıştır.
   (Tablolar, fonksiyonlar, RLS ve `apk` kovası politikaları oluşur.)
2. **Admin**: Panel ▸ SİSTEM ▸ **Site APK (İndirme Sayfası)**
   * APK seç → yükle → "Yükle ve siteye al". Sürüm bilgisi APK'nın içinden okunur.
   * Başlık / alt başlık / duyuru metinlerini yaz, kaydet.
   * Sayfayı deploy ettikten sonra adresini **"İndirme sayfası adresi"** alanına
     yaz: panelden tek dokunuşla açılır ve kopyalanır.
3. **Deploy**: `node apk_web/tools/build.mjs` → `apk_web/public/` üretilir.
   Dağıtım manifesti `apk_web/deploy.json` (`assetsDirectory: ./public`).
   Statik barındırma kullanıyorsan `public/` içeriğini olduğu gibi yükle.

## Yerelde çalıştırma

```bash
node apk_web/tools/serve.mjs            # http://127.0.0.1:5199/
node apk_web/tools/serve.mjs            # örnek görünüm: /?demo=1
```

* `/?demo=1` → ağa çıkmadan örnek sürümle tasarımı gösterir.
* SQL çalıştırılmadıysa sayfa "Sunucuda indirme sayfası kurulu değil" durumunu
  gösterir; bu beklenen davranıştır (indirme düğmesi kapalı kalır).
* Yayında APK yoksa "İndirme dosyası henüz yayınlanmadı" durumu görünür.

## Sayfanın davranışı

* **Tek uç nokta**: `POST /rest/v1/rpc/site_apk_page` — sürüm, boyut, tarih, not,
  indirme sayısı ve metinleri tek çağrıda verir.
* **İndirme**: 20 MB'tan büyük APK'lar depoya parça parça yüklenir
  (`multi|url1|url2…`). Sayfa parçaları sırayla indirip tarayıcıda birleştirir ve
  yüzde gösterir; birleştirme engellenirse ilk parça için doğrudan bağlantı sunar.
* **Sayaç**: "İndir"e basıldığında `site_apk_hit` çağrılır, sayı admin panelinde ve
  sayfada görünür. (Gösterim amaçlıdır; güvenlik kararı buna dayanmaz.)
* **Tazelik**: sayfa 45 saniyede bir ve sekmeye dönüldüğünde kendini yoklar;
  admin sürümü değiştirdiği an indirme düğmesi yeni sürüme geçer.

## Notlar

* APK **aynı geliştirici imzasıyla** imzalanmalıdır; farklı imzalı APK Android
  tarafından reddedilir.
* İkon güncellendiğinde: `node apk_web/tools/resize-icon.mjs` (kaynak:
  `lib/assets/uygulamaicon.png`).
* Sayfa statik olduğu için herhangi bir statik barındırmada çalışır (Cloudflare
  Workers/Sites, GitHub Pages, Nginx…). Sunucu tarafı kod gerekmez.
