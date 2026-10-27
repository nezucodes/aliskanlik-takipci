import test from "node:test";
import assert from "node:assert/strict";
import { buildSummary, monthStart } from "../js/stats.js";

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
