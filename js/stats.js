// Özet istatistikler — saf fonksiyonlar.
// Girdi: habits + entries + bugün. Çıktı: sayılar. DOM yok.

import { daysBetween, isISODate } from "./date.js";
import { longestStreak } from "./streak.js";

function doneEntries(entries) {
  return entries.filter((entry) => entry && entry.done && isISODate(entry.date));
}

/** Ayın ilk günü: "2026-10-27" → "2026-10-01" */
export function monthStart(today) {
  return `${today.slice(0, 8)}01`;
}

/**
 * Genel özet.
 * monthRate hesabında her alışkanlığın kendi başlangıç tarihi dikkate alınır:
 * ayın 20'sinde eklediğin alışkanlık için 20 günlük "yapılmadı" cezası yemezsin.
 */
export function buildSummary(habits, entries, today) {
  if (!isISODate(today)) throw new TypeError(`Geçersiz tarih: ${today}`);

  const done = doneEntries(entries);

  const datesByHabit = new Map();
  for (const entry of done) {
    if (!datesByHabit.has(entry.habitId)) datesByHabit.set(entry.habitId, []);
    datesByHabit.get(entry.habitId).push(entry.date);
  }

  const activeDays = new Set(done.map((entry) => entry.date)).size;
  const bestStreak = habits.reduce(
    (best, habit) => Math.max(best, longestStreak(datesByHabit.get(habit.id) ?? [])),
    0,
  );

  const start = monthStart(today);
  let monthDone = 0;
  let monthPossible = 0;

  for (const entry of done) {
    if (entry.date >= start && entry.date <= today) monthDone += 1;
  }

  for (const habit of habits) {
    // Alışkanlık bu aydan sonra eklendiyse sadece eklendiği günden itibaren say.
    let habitStart = habit.createdAt && habit.createdAt > start ? habit.createdAt : start;

    // "Geçmişe bak" ekranından createdAt'ten ÖNCE bir gün işaretlenebilir.
    // O gün de bir "imkan"dı; saymazsak payda küçülür ve oran %100'ü aşar.
    const monthDates = (datesByHabit.get(habit.id) ?? []).filter(
      (date) => date >= start && date <= today,
    );
    if (monthDates.length > 0) {
      const firstDone = monthDates.reduce((min, date) => (date < min ? date : min), monthDates[0]);
      if (firstDone < habitStart) habitStart = firstDone;
    }

    if (habitStart > today) continue; // gelecekte oluşturulmuş (debug) kayıtlar
    monthPossible += daysBetween(habitStart, today) + 1;
  }

  return {
    total: done.length,
    activeDays,
    bestStreak,
    monthDone,
    monthPossible,
    // Payda her zaman payı kapsar; yine de kayan nokta için üstten sınırlıyoruz.
    monthRate: monthPossible > 0 ? Math.min(1, monthDone / monthPossible) : 0,
  };
}
