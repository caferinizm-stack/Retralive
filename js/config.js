// ─── İndirme sayfası ayarları ──────────────────────────────────────────────
//
// Supabase bağlantısı at yarışı / şanslı dede ile **aynı** projedir. Sayfa
// girişsiz çalışır: yalnız yayına alınmış APK bilgisini ve sayfa metinlerini
// okur (`site_apk_page` fonksiyonu). Sevk edilen bilgiler:
//
//   release  : { version_name, version_code, url, size_bytes, note, downloads }
//   settings : { headline, subtitle, notice, page_url }
//
// Admin panelindeki **Site APK** ekranı bu veriyi yazar; admin sürümü
// değiştirdiği an sayfa (realtime ya da yoklama) güncellenir.

export const SUPABASE = {
  url: 'https://mwjyppehzqobmcrsmxlj.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13anlwcGVoenFvYm1jcnNteGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODYxOTksImV4cCI6MjEwNTc2MjE5OX0.OWXeMWkfzwftIJXGR4Pkr66mBq4IB5u6vM9T7I7Nx-0',
};

/** Sayfa kendini kaç ms'de bir yoklar (realtime kapalıysa da güncel kalır). */
export const POLL_MS = 45000;

/** İndirilen dosyanın adı: `retra-1.0.9.apk`. */
export function fileName(release) {
  const name = (release?.version_name || '').trim().replace(/[^\w.\-]+/g, '_');
  const code = Number(release?.version_code || 0);
  const suffix = name || (code > 0 ? String(code) : 'son');
  return `retra-${suffix}.apk`;
}

/** "Öne çıkanlar" listesi (sayfa sabittir, sunucudan gelmez). */
export const FEATURES = [
  {
    icon: '🎙️',
    title: 'Sesli odalar',
    text: '5–20 kişilik koltuk düzeni, oda kilidi, oda müziği ve gerçek zamanlı sohbet.',
  },
  {
    icon: '📺',
    title: 'Canlı yayın',
    text: 'Kamera + mikrofon yayını, konuk alma, izleyici sayısı ve yayıncı kazanç geçmişi.',
  },
  {
    icon: '🎁',
    title: 'Hediyeler & kristal',
    text: 'Video efektli hediyeler, hediye çantası, şanslı çanta ve kristal ekonomisi.',
  },
  {
    icon: '🎰',
    title: 'Şans oyunları',
    text: 'Slot, plinko, roket, blackjack, at yarışı ve şanslı dede — hepsi odanın içinde.',
  },
  {
    icon: '👑',
    title: 'VIP & kozmetik',
    text: 'VIP1–5 ve SVIP1–6, çerçeve, tema, efekt, seviye ve karizma rozetleri.',
  },
  {
    icon: '✨',
    title: 'Keşfet & takip',
    text: 'Foto, video ve ses paylaşımı; beğeni, yorum, takipçi ve mesajlar.',
  },
];

/** Kurulum adımları. */
export const STEPS = [
  'Aşağıdaki indirme düğmesine bas — APK inmeye başlar.',
  'İndirilen dosyayı bildirim çubuğundan ya da Dosyalar ▸ İndirilenler klasöründen aç.',
  'Android “bilinmeyen kaynaklardan yüklemeye izin ver” derse bu tarayıcı için izni aç.',
  '“Kur”a bas ve kurulumun bitmesini bekle.',
  'Uygulamayı aç, giriş yap ve odalara katıl — kristal bakiyen hesapla ortaktır.',
];

/** `?demo=1` ile gösterilen örnek veri (yerelde/preview'da denenebilir). */
export const DEMO_PAGE = {
  ok: true,
  release: {
    version_name: '1.0.9',
    version_code: 9,
    // tek parça örnek adres; `multi|url1|url2` de desteklenir.
    url: 'https://mwjyppehzqobmcrsmxlj.supabase.co/storage/v1/object/public/apk/site/ornek.apk',
    size_bytes: 73400320,
    note: '• Sesli odalarda bağlantı kararlılığı artırıldı\n• Yeni: şanslı dede bonus turu\n• Küçük hata düzeltmeleri',
    downloads: 1247,
  },
  settings: {
    headline: 'RETRA’yı telefonuna indir',
    subtitle: 'Sesli odalar · canlı yayın · hediyeler · şans oyunları',
    notice: 'Örnek görünüm (demo): gerçek sürüm sunucudan gelir.',
    page_url: '',
  },
  downloads_total: 4310,
};
