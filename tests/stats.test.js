import test from "node:test";
import assert from "node:assert/strict";
import { activeHabitsOn, buildSummary, isHabitActiveOn, monthStart, rateWindow } from "../js/stats.js";

const TODAY = "2026-10-27";

const habits = [
  { id: "a", name: "Kitap", createdAt: "2026-10-01" },
  { id: "b", name: "Spor", createdAt: "2026-10-01" },
];

test("monthStart ayın ilk gününü verir", () => {
  assert.equal(monthStart("2026-10-27"), "2026-10-01");
});

test("toplam sadece done kayıtları sayar", () => {
  const entries = [
    { habitId: "a", date: "2026-10-26", done: true },
    { habitId: "a", date: "2026-10-27", done: true },
    { habitId: "b", date: "2026-10-27", done: false }, // not var ama yapılmamış
  ];
  assert.equal(buildSummary(habits, entries, TODAY).total, 2);
});

test("aktif gün benzersiz gün sayısıdır", () => {
  const entries = [
    { habitId: "a", date: "2026-10-26", done: true },
    { habitId: "b", date: "2026-10-26", done: true },
    { habitId: "a", date: "2026-10-27", done: true },
  ];
  assert.equal(buildSummary(habits, entries, TODAY).activeDays, 2);
});

test("en uzun seri alışkanlıklar arasında en iyisidir", () => {
  const entries = [
    { habitId: "a", date: "2026-10-25", done: true },
    { habitId: "a", date: "2026-10-26", done: true },
    { habitId: "a", date: "2026-10-27", done: true },
    { habitId: "b", date: "2026-10-26", done: true },
  ];
  assert.equal(buildSummary(habits, entries, TODAY).bestStreak, 3);
});

test("aylık oran ayın geçen günlerine göre hesaplanır", () => {
  // 1-27 Ekim = 27 gün, 2 alışkanlık = 54 olası; 27 tamamlama → 0.5
  const entries = [];
  for (let day = 1; day <= 27; day += 1) {
    entries.push({ habitId: "a", date: `2026-10-${String(day).padStart(2, "0")}`, done: true });
  }
  const summary = buildSummary(habits, entries, TODAY);
  assert.equal(summary.monthDone, 27);
  assert.equal(summary.monthPossible, 54);
  assert.equal(summary.monthRate, 0.5);
});

test("ay ortasında eklenen alışkanlık geçmişten ceza almaz", () => {
  const lateHabits = [
    { id: "a", name: "Yeni", createdAt: "2026-10-27" },
  ];
  const entries = [{ habitId: "a", date: "2026-10-27", done: true }];
  const summary = buildSummary(lateHabits, entries, TODAY);
  assert.equal(summary.monthPossible, 1);
  assert.equal(summary.monthRate, 1);
});

test("boş veride sıfır döner, hata atmaz", () => {
  const summary = buildSummary([], [], TODAY);
  assert.deepEqual(
    { total: summary.total, activeDays: summary.activeDays, bestStreak: summary.bestStreak, rate: summary.monthRate },
    { total: 0, activeDays: 0, bestStreak: 0, rate: 0 },
  );
});

test("createdAt'ten önce işaretlenen günler oranı %100'ün üstüne çıkarmaz", () => {
  // Kullanıcı "geçmişe bak" ile 20 Ekim'i işaretlemiş ama alışkanlık 27'sinde eklenmiş.
  const lateHabits = [{ id: "a", name: "Yeni", createdAt: "2026-10-27" }];
  const entries = [
    { habitId: "a", date: "2026-10-20", done: true },
    { habitId: "a", date: "2026-10-27", done: true },
  ];
  const summary = buildSummary(lateHabits, entries, TODAY);
  assert.equal(summary.monthDone, 2);
  assert.equal(summary.monthPossible, 8); // 20 → 27 Ekim
  assert.equal(summary.monthRate, 0.25);
  assert.ok(summary.monthRate <= 1);
});

test("geçersiz tarihli kayıtlar yok sayılır", () => {
  const entries = [
    { habitId: "a", date: "bozuk", done: true },
    { habitId: "a", date: "2026-10-27", done: true },
  ];
  assert.equal(buildSummary(habits, entries, TODAY).total, 1);
});

test("geçersiz today hata fırlatır", () => {
  assert.throws(() => buildSummary(habits, [], "27.10.2026"), TypeError);
});

test("alışkanlık eklenmeden önceki günlerde geçerli değildir", () => {
  const late = { id: "a", name: "Yeni", createdAt: "2026-10-20" };
  assert.equal(isHabitActiveOn(late, "2026-10-19"), false);
  assert.equal(isHabitActiveOn(late, "2026-10-20"), true); // eklendiği gün dahil
  assert.equal(isHabitActiveOn(late, "2026-10-27"), true);
});

test("arşivlenen alışkanlık arşiv gününde geçerli, sonrasında değil", () => {
  const old = { id: "b", name: "Eski", createdAt: "2026-10-01", archivedAt: "2026-10-10" };
  assert.equal(isHabitActiveOn(old, "2026-10-09"), true);
  assert.equal(isHabitActiveOn(old, "2026-10-10"), true);
  assert.equal(isHabitActiveOn(old, "2026-10-11"), false);
});

test("activeHabitsOn o günün paydasını verir", () => {
  const list = [
    { id: "a", name: "Erken", createdAt: "2026-10-01" },
    { id: "b", name: "Geç", createdAt: "2026-10-25" },
  ];
  assert.deepEqual(activeHabitsOn(list, "2026-10-10").map((h) => h.id), ["a"]);
  assert.deepEqual(activeHabitsOn(list, "2026-10-25").map((h) => h.id), ["a", "b"]);
  assert.deepEqual(activeHabitsOn(list, "2026-09-30"), []);
});

test("arşivlenen alışkanlık aylık paydada sadece yaşadığı günleri sayar", () => {
  const archived = [
    { id: "a", name: "Eski", createdAt: "2026-10-01", archivedAt: "2026-10-10" },
  ];
  const entries = [
    { habitId: "a", date: "2026-10-05", done: true },
    { habitId: "a", date: "2026-10-09", done: true },
  ];
  const summary = buildSummary(archived, entries, TODAY);
  assert.equal(summary.monthDone, 2);
  assert.equal(summary.monthPossible, 10); // 1 → 10 Ekim
});

test("kart oranı: yeni alışkanlığın penceresi eklenme gününde başlar", () => {
  // Dün eklenen alışkanlık "son 30 gün %3" değil, 2 günün 2'si olmalı.
  const habit = { id: "a", createdAt: "2026-10-28" };
  assert.deepEqual(rateWindow(habit, ["2026-10-28", "2026-10-29"], "2026-10-29"), {
    from: "2026-10-28",
    to: "2026-10-29",
  });
});

test("kart oranı: eski alışkanlıkta pencere 30 gündür", () => {
  const habit = { id: "a", createdAt: "2026-01-01" };
  assert.equal(rateWindow(habit, [], "2026-10-29").from, "2026-09-30");
});

test("kart oranı: geriye dönük işaretlenen gün pencereyi açar", () => {
  const habit = { id: "a", createdAt: "2026-10-20" };
  assert.equal(rateWindow(habit, ["2026-10-15"], "2026-10-29").from, "2026-10-15");
});

test("kart oranı: pencere 30 günden eskiye inmez", () => {
  const habit = { id: "a", createdAt: "2026-01-01" };
  assert.equal(rateWindow(habit, ["2026-01-05"], "2026-10-29").from, "2026-09-30");
});

test("kart oranı: geçersiz gün sayısını reddeder", () => {
  assert.throws(() => rateWindow({ id: "a" }, [], TODAY, 0), RangeError);
});
