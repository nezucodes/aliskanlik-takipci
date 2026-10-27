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
| 3 · Kendi API + SQLite | ⬜ |
| 4 · PWA + tema + yedekleme | ⬜ |
| 5 · Yayın (deploy) | ⬜ |
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
- [ ] `server/` klasörü: Node + Express (veya Fastify)
- [ ] SQLite şeması: `habits`, `entries`
- [ ] REST endpoint'leri: GET/POST/PATCH/DELETE + `PUT /entries/:habitId/:date`
- [ ] Girdi doğrulama, anlamlı HTTP durum kodları
- [ ] `store.js` → `apiStore.js`: **aynı fonksiyon isimleri**, içi `fetch`
- [ ] Arayüzde tek satır değişmeden geçiş (repository pattern kanıtı)

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
- [ ] `manifest.webmanifest`: isim, ikon, tema rengi, tam ekran
- [ ] `sw.js`: çevrimdışı önbellek (offline açılış)
- [ ] Ana ekrana ekleme (iPhone + Mac)
- [ ] Açık/koyu/sistem tema anahtarı
- [ ] JSON dışa/içe aktarma (yedek)

**Kazanım**
- Service worker yaşam döngüsü ve önbellek stratejileri
- "Web sitesi" ile "kurulabilir uygulama" arasındaki fark
- Tema sistemleri, `prefers-color-scheme`, kullanıcı tercihi saklama
- Veri taşınabilirliği ve yedekleme sorumluluğu

---

## Aşama 5 — Yayın (1-2 gün)

**Yapılacaklar**
- [ ] Frontend: GitHub Pages
- [ ] API: ücretsiz bir host (Fly.io / Render / kendi VPS)
- [ ] Ortam değişkenleri, CORS, HTTPS
- [ ] README: ekran görüntüsü, kurulum, mimari şeması
- [ ] Lighthouse ≥ 95 kontrolü

**Kazanım**
- Deploy kavramı: build, ortam, URL, DNS
- CORS'un neden var olduğu (ve neden can sıkıcı olduğu)
- Gerçek kullanıcıya açık ürün yayınlama deneyimi
- Portfolyoda canlı link + kaynak kod

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
