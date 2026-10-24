// Seri (streak) mantığı — saf fonksiyonlar.
// Girdi: tamamlanmış günlerin listesi. Çıktı: sayı.
// DOM yok, localStorage yok, yan etki yok → test etmesi kolay.

import { addDays, daysBetween, isISODate } from "./date.js";

/** Tekrarları temizle, geçersizleri at. */
function toSet(doneDates) {
  const set = new Set();
  for (const date of doneDates) {
    if (isISODate(date)) set.add(date);
  }
  return set;
}

/**
 * Güncel seri.
 *
 * İnce nokta: bugün henüz işaretlenmediyse seri sıfırlanmaz.
 * Dünden geriye doğru sayılır. Yoksa her sabah seri 0 görünürdü.
 */
export function computeStreak(doneDates, today) {
  if (!isISODate(today)) throw new TypeError(`Geçersiz tarih: ${today}`);
  const done = toSet(doneDates);

  let cursor = today;
  if (!done.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!done.has(cursor)) return 0; // dün de yoksa seri bitmiş
  }

  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** En uzun seri (tüm geçmişte). */
export function longestStreak(doneDates) {
  const sorted = [...toSet(doneDates)].sort();
  let best = 0;
  let run = 0;
  let previous = null;

  for (const date of sorted) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1;
    if (run > best) best = run;
    previous = date;
  }
  return best;
}

/**
 * Tamamlama oranı: [from, to] aralığında işaretli gün sayısı / toplam gün.
 * 0..1 arası döner. Ekranda yüzdeye çeviririz.
 */
export function completionRate(doneDates, from, to) {
  if (!isISODate(from) || !isISODate(to)) throw new TypeError("Geçersiz tarih aralığı");
  if (from > to) throw new RangeError("Başlangıç bitişten sonra olamaz");

  const done = toSet(doneDates);
  const total = daysBetween(from, to) + 1;
  let hits = 0;

  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (done.has(date)) hits += 1;
  }
  return total === 0 ? 0 : hits / total;
}
