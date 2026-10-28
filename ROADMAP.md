# Yol Haritası ve Kazanımlar

> Proje: Alışkanlık Takipçisi (web app → API → PWA → iOS)
> Tempo: günde ~1 saat, hafta sonu daha uzun.
> Bu dosya canlıdır: her aşama bitince işaretlenir.

## Neredeyiz?

| Aşama | Durum |
|---|---|
| 0 · MVP (CRUD + streak + testler) | ✅ bitti |
| 1 · Analitik (haftalık görünüm + ısı haritası) | ✅ bitti |
| 2 · İstatistik paneli + düzenleme | ✅ bitti |
| 3 · Kendi API + SQLite | ✅ bitti |
| 4 · PWA + tema + yedekleme | ✅ bitti |
| 5 · Yayın (deploy) | ✅ bitti |
| 6 · iOS (SwiftUI) portu | ⬜ opsiyonel |

---

## Aşama 2 — İstatistik paneli + düzenleme (3-4 gün)

**Yapılacaklar**
- [x] Özet kartları: toplam tamamlama, en uzun seri, bu ayki oran, aktif gün sayısı
- [x] Alışkanlığı yeniden adlandırma (kalem butonu)
- [x] Renk seçimi (pastel palet)
- [x] Arşivlenenleri görme + geri getirme (soft delete'in karşılığı)
- [x] Boş durumlar

**Kazanım**
- Türetilmiş veri (aggregate) mantığı: aynı veriden 5 farklı özet
- Fonksiyonel düşünme: `summarize(habits, entries)` gibi saf fonksiyon
- Form durumu yönetimi: düzenleme modu, iptal, doğrulama
- Ürün kararı: hangi metrik gerçekten anlamlı?

---

## Aşama 3 — Kendi API + SQLite (1-2 hafta)

**Yapılacaklar**
- [x] `server/` klasörü: Node + Express
- [x] SQLite şeması: `habits`, `entries` (Node yerleşik `node:sqlite`)
- [x] REST endpoint'leri: GET/POST/PATCH/DELETE + `PUT /entries/:habitId/:date`
- [x] Girdi doğrulama, anlamlı HTTP durum kodları
- [x] `store.js` → `apiStore.js`: **aynı fonksiyon isimleri**, içi `fetch`
- [x] Arayüzde minimum değişiklikle geçiş (repository pattern kanıtı)
- [x] localStorage → SQLite tek seferlik veri taşıma (`POST /api/import`)
- [x] API entegrasyon testleri (fetch ile gerçek HTTP)

**Kazanım**
- HTTP'nin gerçek anlamı: metot, durum kodu, gövde, idempotency
- İstemci/sunucu ayrımı ve veri sahipliği
- SQL: tablo, birincil anahtar, ilişki, sorgu
- Katmanlı mimari: UI → store sözleşmesi → HTTP → DB
- Hata yönetimi: ağ hatası, 404, 500, yeniden deneme
- Neden auth'a henüz gerek yok; sonra nasıl eklenir

---

## Aşama 4 — PWA + tema + yedekleme (3-5 gün)

**Yapılacaklar**
- [x] `manifest.webmanifest`: isim, ikon, tema rengi, tam ekran
- [x] `sw.js`: çevrimdışı önbellek (offline açılış)
- [x] Ana ekrana ekleme (manifest + SW hazır; iPhone/Mac'te "Ana Ekrana Ekle" ile denenebilir)
- [x] Açık/koyu/sistem tema anahtarı
- [x] JSON dışa/içe aktarma (yedek)

**Kazanım**
- Service worker yaşam döngüsü ve önbellek stratejileri
- "Web sitesi" ile "kurulabilir uygulama" arasındaki fark
- Tema sistemleri, `prefers-color-scheme`, kullanıcı tercihi saklama
- Veri taşınabilirliği ve yedekleme sorumluluğu

**Teknik notlar**
- Önbellek stratejisi **network-first**: çevrimiçiyken hep taze dosya, çevrimdışıyken son sürüm.
  Geliştirirken bayat kod görmemek için bilinçli seçim (cache-first olsaydı her değişiklikte sürüm artırmak gerekirdi).
- `/api/` istekleri **asla** önbelleğe alınmaz: kullanıcı verisi bayat olmamalı. Veri için sunucu şart,
  uygulama bunu "Çevrimdışısın. Veriler sunucuda..." mesajıyla açıkça söyler.
- Tema: tercih `light | dark | system` olarak saklanır, **gerçek tema türetilir** (`resolveTheme`).
  İlk boyamadan önce çalışan küçük satır içi script, koyu temada beyaz ekran parlamasını (FOUC) engeller.
- Koyu temada ısı haritasının "boş gün" rengi kart zemininden ayrı tutulur (`--heat-0`),
  yoksa 0 kayıt ile 1 kayıt ayırt edilemiyordu.
- Yedek formatı: `{ app, version, exportedAt, habits, archived, entries }`.
  İçe aktarma **isim bazlı birleştirir** (id değil) ve hiçbir şeyi silmez → round-trip kopya üretmez.

---

## Aşama 5 — Yayın (1-2 gün)

**Yapılacaklar**
- [x] Frontend: GitHub Pages
- [x] API: ücretsiz bir host (Fly.io / Render / kendi VPS)
- [x] Ortam değişkenleri, CORS, HTTPS
- [x] README: ekran görüntüsü, kurulum, mimari şeması
- [x] Lighthouse ≥ 95 kontrolü

**Kazanım**
- Deploy kavramı: build, ortam, URL, DNS
- CORS'un neden var olduğu (ve neden can sıkıcı olduğu)
- Gerçek kullanıcıya açık ürün yayınlama deneyimi
- Portfolyoda canlı link + kaynak kod

**Canlı adresler**
- Arayüz: <https://nezucodes.github.io/aliskanlik-takipci/>
- API: <https://aliskanlik-api.onrender.com/api/health>

**Teknik notlar**
- **İki origin:** statik dosyalar Pages'te, API Render'da. Tarayıcı farklı origin'e istek
  atarken önce izin sorar (preflight); sunucu `ALLOWED_ORIGINS` listesindekilere
  `Access-Control-Allow-Origin` döner. CORS bir sunucu güvenliği değil, tarayıcı politikasıdır.
- **Göreli yollar:** Pages uygulamayı `/aliskanlik-takipci/` alt dizininde servis eder.
  Bu yüzden manifest, ikonlar ve service worker yolları göreli; `start_url` ve `scope` `"./"`.
  Kök mutlak yol (`/icons/...`) burada kırılırdı.
- **Ortam algılama:** `js/config.js` host'a bakar. Build adımı olmadığı için ortam
  değişkeni yok; build eklenirse `import.meta.env.VITE_API_URL` olurdu.
- **Ücretsiz katman:** Render servisi 15 dk hareketsizlikte uyur (ilk istek 30–60 sn) ve
  diski kalıcı değildir — yeniden deploy'da SQLite sıfırlanır. Bu yüzden JSON yedek
  (Aşama 4) gerçek bir veri sahipliği aracı.
- **Hata dürüstlüğü:** yayında "terminalde `npm run server` çalışıyor mu?" demek yanlış;
  mesaj ortama göre değişiyor ve "Tekrar dene" düğmesi soğuk başlangıcı telafi ediyor.
- **Lighthouse:** 100 erişilebilirlik / 100 en iyi uygulamalar / 100 SEO.
  Tek eksik, `aria-label` taşıyan rolsüz `div`'lerdi (`role="img"` / `role="group"` eklendi).

---

## Aşama 6 — iOS portu (opsiyonel, 2-4 hafta)

**Yapılacaklar**
- [ ] Xcode + Swift temelleri
- [ ] SwiftUI ile aynı ekranlar: liste, işaretleme, streak
- [ ] Yerel veri: SwiftData / UserDefaults
- [ ] Simülatörde çalıştır, TestFlight'a yükle

**Kazanım**
- Aynı ürünü ikinci kez, farklı platformda yazmak → mimari kavrayış
- Swift dil temelleri, SwiftUI'da state (`@State`, `@Observable`)
- Xcode, simülatör, imzalama, TestFlight süreci
- "Web'de öğrendiğim her şey burada da geçerli" deneyimi

---

## Proje bitince elinde ne olacak?

### Teknik kazanımlar
| Alan | Somut beceri |
|---|---|
| HTML/CSS | Anlamsal yapı, erişilebilirlik, CSS değişkenleri, Grid/Flexbox, akışkan tipografi, pastel tema |
| JavaScript | ES modülleri, DOM, olaylar, state yönetimi, saf fonksiyonlar, tarih/saat dilimi tuzakları |
| Test | `node:test` ile birim test, sınır durumları, regresyon |
| Veri modelleme | Türetme vs saklama, idempotency, soft delete, şema evrimi |
| Mimari | Repository pattern, katman ayrımı, sözleşme odaklı tasarım |
| Backend | Node, Express, REST, SQLite, doğrulama, HTTP durum kodları |
| PWA | Manifest, service worker, offline, kurulabilirlik |
| Git | Anlamlı commit, push, branch, (ileride) PR |
| Ürün | MVP kapsamı, özellik eleme, kullanıcı akışı, metrik seçimi |

### Somut çıktılar
- GitHub'da düzenli commit geçmişi olan bir repo
- İnternette çalışan **canlı bir uygulama**
- Telefona kurulabilen PWA
- README'de mimari şeması + ekran görüntüleri
- 20+ birim test
- (Opsiyonel) App Store / TestFlight'ta iOS sürümü

### Kariyer açısından
- Portfolyoda "yaptım" diyebileceğin gerçek bir ürün
- Görüşmede anlatabileceğin kararlar: "neden framework kullanmadım", "neden seriyi saklamadım", "neden repository pattern"
- iOS geliştirici yoluna somut bir köprü

---

## Bu proje neyi öğretmez? (dürüst sınırlar)

- **React/Next.js** — bilinçli olarak yok. Framework'ü, ihtiyaç duyduğunda öğreneceksin.
- **Gerçek kimlik doğrulama** — tek kullanıcı varsayımı var. Auth ayrı bir proje konusu.
- **Ölçek/performans** — binlerce kullanıcı, önbellek, kuyruk yok.
- **CI/CD** — otomatik test/publish hattı opsiyonel.
- **Güvenlik derinliği** — XSS'e dikkat ediyoruz ama tam bir güvenlik incelemesi değil.
- **App Store yayıncılığı** — Aşama 6'ya kadar yok.

Bunlar eksiklik değil, **bilinçli kapsam dışı**. Her biri kendi projesini hak eder.
