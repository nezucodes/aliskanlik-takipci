# Alışkanlık Takipçisi + API — Proje Brief'i

> Tek cümle: "Her gün yaptığım şeyleri tek dokunuşla işaretleyip serimi (streak) görebileceğim, telefonumda uygulama gibi çalışan bir takipçi."

## 1. Neden bu proje

- Gerçekten kullanılabilir (motivasyon)
- Veri + mantık var, sadece görünüm değil
- 2 haftada çalışan sürüm çıkar
- Aynı ürünü sonra SwiftUI'da yazınca iOS'a geçiş doğal olur
- PWA yaparsak iPhone ana ekranına kurulabilir → "app gibi" his

## 2. MVP kapsamı

| Özellik | Var | Yok (bilinçli) |
|---|---|---|
| Alışkanlık ekle / sil / yeniden adlandır | ✅ | Kategori, etiket |
| Bugünü işaretle (tek dokunuş) | ✅ | Geriye dönük düzenleme (hafta 2) |
| Günlük liste | ✅ | Bildirim / hatırlatıcı |
| Seri (streak) ve tamamlama oranı | ✅ | Grafikler (hafta 2) |
| Karanlık mod | ✅ | Çoklu kullanıcı / giriş |
| PWA (ana ekrana ekle) | ✅ (hafta 2) | Bulut senkronizasyonu |
| Veriler nerede? | localStorage → sonra SQLite API | |

**Kural:** Yeni fikir gelirse `BRIEF.md`'ye "v2" olarak yazılır, MVP'ye girmez.

## 3. Veri modeli (projenin kalbi)

İki tablo/koleksiyon:

```jsonc
// habit
{ "id": "uuid", "name": "Kitap oku", "emoji": "📚", "color": "#6c5ce7",
  "createdAt": "2026-10-24", "archivedAt": null }

// entry  (tek gerçek kaynak: "o gün yapıldı mı?")
{ "habitId": "uuid", "date": "2026-10-24", "done": true }
```

**Kritik karar: streak'i saklamıyoruz, hesaplıyoruz.**
Seri bir *sonuç*tur, veri değil. Entry'lerden türetilir. Böylece:
- Geçmişi düzeltince istatistik kendiliğinden doğru olur
- Veri tekrarı / tutarsızlık olmaz
- "Neden 5 gösteriyor?" sorusunun tek cevabı olur

**Tarih kuralı:** `YYYY-MM-DD` **yerel** tarih string'i kullanılır, `Date.now()` timestamp'i değil.
Sebep: gece 00:30'da işaretlenen şey UTC'de önceki güne düşer. Klasik tuzak.

**Seri hesabı (algoritma):**
1. Bugünden geriye doğru yürü.
2. O gün entry varsa ve `done` ise sayacı artır.
3. İlk `done:false` veya boş günde dur.
4. "Bugün henüz işaretlenmediyse seri bozulmuş sayılmaz" istisnasını unutma (yoksa her sabah seri 0 görünür).

## 4. Mimari: iki hafta, tek arayüz

```
hafta 1                        hafta 2
┌─────────────┐               ┌─────────────┐
│  index.html │               │  index.html │   ← değişmez
│  app.js     │               │  app.js     │   ← değişmez
│  store.js   │  localStorage │  store.js   │ → fetch → API
└─────────────┘               └─────────────┘              ↓
                                                    Node + SQLite
```

**Fikir:** `store.js` tek bir sözleşme sunar:

```js
listHabits()            // → Habit[]
createHabit(input)      // → Habit
toggleEntry(habitId, date, done)
listEntries(from, to)   // → Entry[]
```

Hafta 1 bunu localStorage ile, hafta 2 aynı fonksiyonları HTTP ile doldururuz.
**Arayüz aynı kalır → üst katman haberi bile olmaz.** Buna "repository pattern" denir; profesyonel projelerde de tam olarak bu yüzden kullanılır.

## 5. API taslağı (hafta 2)

| Metot | Yol | Gövde / Not |
|---|---|---|
| GET | `/api/habits` | arşivlenmemişler |
| POST | `/api/habits` | `{name, emoji, color}` |
| PATCH | `/api/habits/:id` | kısmi güncelleme |
| DELETE | `/api/habits/:id` | soft delete (`archivedAt`) |
| GET | `/api/entries?from=&to=` | tarih aralığı |
| PUT | `/api/entries/:habitId/:date` | `{done: true}` — idempotent |

SQLite şeması:

```sql
CREATE TABLE habits (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT, color TEXT,
  created_at TEXT NOT NULL, archived_at TEXT
);
CREATE TABLE entries (
  habit_id TEXT NOT NULL REFERENCES habits(id),
  date TEXT NOT NULL,            -- YYYY-MM-DD
  done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (habit_id, date)
);
```

## 6. Dosya yapısı

```
aliskanlik-takipci/
├── index.html
├── styles.css
├── js/
│   ├── app.js        # UI + olaylar
│   ├── store.js      # veri sözleşmesi (hafta 1: localStorage)
│   ├── streak.js     # saf fonksiyonlar: seri, oran
│   └── date.js       # yerel tarih yardımcıları
├── manifest.webmanifest
├── sw.js             # hafta 2: çevrimdışı
└── server/           # hafta 2
    ├── index.js
    └── db.js
```

`streak.js` ve `date.js` **saf fonksiyon** olacak: girdi alır, çıktı verir, DOM'a dokunmaz. Böylece test edilebilir ve iOS'a taşınabilir.

## 7. Kilometre taşları

| # | Hedef | Bitti sayılır |
|---|---|---|
| 1 | İskelet | Sayfa açılıyor, boş liste görünüyor |
| 2 | Ekle/sil | Alışkanlık ekleniyor, yenilenince kaybolmuyor |
| 3 | İşaretle | Bugün tek dokunuşla işaretleniyor |
| 4 | Seri | Streak doğru hesaplanıyor (test senaryolarıyla) |
| 5 | Görünüm | Mobilde tek elle kullanılabilir, karanlık mod |
| 6 | API | Aynı arayüz, veriler SQLite'ta |
| 7 | PWA | iPhone ana ekranına ekleniyor, çevrimdışı açılıyor |

## 8. Öğrenme notları (kendi cümlelerimle)

- **State** → uygulamanın o anki verisi. UI, state'in fotoğrafıdır.
- **Türetilmiş veri** → saklanmaz, hesaplanır (streak). Tekrar eden veri = kaçınılmaz tutarsızlık.
- **Saf fonksiyon** → aynı girdi, aynı çıktı; yan etkisi yok. Test etmesi kolay.
- **Repository pattern** → verinin *nereden* geldiğini üst katmandan saklamak.
- **Idempotent** → aynı isteği 2 kez atsan sonuç değişmez (`PUT ... {done:true}`).
- **PWA** → web sitesi + manifest + service worker = telefona kurulabilen uygulama.
