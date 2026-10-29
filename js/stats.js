// Özet istatistikler — saf fonksiyonlar.
// Girdi: habits + entries + bugün. Çıktı: sayılar. DOM yok.

import { addDays, daysBetween, isISODate } from "./date.js";
import { longestStreak } from "./streak.js";

function doneEntries(entries) {
  return entries.filter((entry) => entry && entry.done && isISODate(entry.date));
}

/**
 * Alışkanlık belirli bir günde "geçerli" miydi?
 *
 * Neden gerekli: 20 Ekim'de eklediğin alışkanlık 1 Ekim için "yapılmadı"
 * sayılmamalı. Aynı şekilde arşivlenen alışkanlık arşivden sonraki günlerde
 * beklenen bir şey değil.
 *
 * Sınırlar dahil: createdAt günü sayılır, archivedAt günü de sayılır
 * (o gün hâlâ listedeydi).
 */
export function isHabitActiveOn(habit, date) {
  if (!habit || !isISODate(date)) return false;
  if (habit.createdAt && habit.createdAt > date) return false;
  if (habit.archivedAt && habit.archivedAt < date) return false;
  return true;
}

/** Belirli bir günde geçerli olan alışkanlıklar. Payda buradan gelir. */
export function activeHabitsOn(habits, date) {
  return habits.filter((habit) => isHabitActiveOn(habit, date));
}

/**
 * Kart üstündeki "son N gün" oranının penceresi.
 *
 * Düz "bugün-(N-1) → bugün" penceresi yeni alışkanlığı cezalandırır:
 * dün eklenen bir şey "son 30 gün %3" gösterirdi. Pencere alışkanlığın
 * var olduğu günlerle kesişir. Geriye dönük işaretlenen gün varsa pencere
 * o güne kadar açılır (payda da büyür, oran %100'ü aşmaz).
 */
export function rateWindow(habit, doneDates, today, days = 30) {
  if (!isISODate(today)) throw new TypeError(`Geçersiz tarih: ${today}`);
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`Geçersiz gün sayısı: ${days}`);

  const windowStart = addDays(today, -(days - 1));
  let from = habit?.createdAt && habit.createdAt > windowStart ? habit.createdAt : windowStart;

  for (const date of doneDates) {
    if (isISODate(date) && date >= windowStart && date <= today && date < from) from = date;
  }

  return { from, to: today };
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

  for (const habit of habits) {
    // Pencere: ay başı (ya da eklenme günü) → bugün (ya da arşiv günü).
    let habitStart = habit.createdAt && habit.createdAt > start ? habit.createdAt : start;
    let habitEnd = habit.archivedAt && habit.archivedAt < today ? habit.archivedAt : today;

    const monthDates = (datesByHabit.get(habit.id) ?? []).filter(
      (date) => date >= start && date <= today,
    );

    // "Geçmişe bak" ekranından createdAt'ten ÖNCE bir gün işaretlenebilir.
    // O gün de bir "imkan"dı; saymazsak payda küçülür ve oran %100'ü aşar.
    // Aynı mantık arşivden sonra işaretlenen günler için de geçerli.
    if (monthDates.length > 0) {
      const firstDone = monthDates.reduce((min, date) => (date < min ? date : min), monthDates[0]);
      const lastDone = monthDates.reduce((max, date) => (date > max ? date : max), monthDates[0]);
      if (firstDone < habitStart) habitStart = firstDone;
      if (lastDone > habitEnd) habitEnd = lastDone;
    }

    if (habitStart > habitEnd) continue; // gelecekte oluşturulmuş (debug) kayıtlar
    monthPossible += daysBetween(habitStart, habitEnd) + 1;
    monthDone += monthDates.filter((date) => date >= habitStart && date <= habitEnd).length;
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
