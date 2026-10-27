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
    const habitStart = habit.createdAt && habit.createdAt > start ? habit.createdAt : start;
    if (habitStart > today) continue; // gelecekte oluşturulmuş (debug) kayıtlar
    monthPossible += daysBetween(habitStart, today) + 1;
  }

  return {
    total: done.length,
    activeDays,
    bestStreak,
    monthDone,
    monthPossible,
    monthRate: monthPossible > 0 ? monthDone / monthPossible : 0,
  };
}
