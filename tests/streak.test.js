import test from "node:test";
import assert from "node:assert/strict";
import { completionRate, computeStreak, longestStreak } from "../js/streak.js";

const TODAY = "2026-10-24";

test("bugün ve geçmiş günler işaretliyse seri sayılır", () => {
  assert.equal(computeStreak(["2026-10-22", "2026-10-23", "2026-10-24"], TODAY), 3);
});

test("bugün işaretli değilse dünden sayılır (sabah sendromu)", () => {
  assert.equal(computeStreak(["2026-10-22", "2026-10-23"], TODAY), 2);
});

test("bugün de dün de yoksa seri sıfırdır", () => {
  assert.equal(computeStreak(["2026-10-22"], TODAY), 0);
  assert.equal(computeStreak([], TODAY), 0);
});

test("aradaki boşluk seriyi keser", () => {
  assert.equal(computeStreak(["2026-10-20", "2026-10-21", "2026-10-24"], TODAY), 1);
  assert.equal(computeStreak(["2026-10-21", "2026-10-23", "2026-10-24"], TODAY), 2);
});

test("ay ve yıl sınırını aşan seri doğru", () => {
  assert.equal(computeStreak(["2026-12-30", "2026-12-31", "2027-01-01"], "2027-01-01"), 3);
  assert.equal(computeStreak(["2028-02-28", "2028-02-29", "2028-03-01"], "2028-03-01"), 3);
});

test("tekrarlanan ve geçersiz tarihler sonucu bozmaz", () => {
  assert.equal(computeStreak(["2026-10-23", "2026-10-23", "bozuk", null, "2026-10-24"], TODAY), 2);
});

test("geçersiz today hata fırlatır", () => {
  assert.throws(() => computeStreak(["2026-10-24"], "24.10.2026"), TypeError);
});

test("longestStreak sırasız girdide de doğru çalışır", () => {
  const dates = ["2026-10-05", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-10"];
  assert.equal(longestStreak(dates), 3);
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(["2026-10-01"]), 1);
});

test("completionRate aralığı kapsayıcı sayar", () => {
  // 22-24 Ekim = 3 gün, 2'si işaretli → 2/3
  assert.equal(completionRate(["2026-10-22", "2026-10-23"], "2026-10-22", "2026-10-24"), 2 / 3);
  // tek gün
  assert.equal(completionRate(["2026-10-24"], "2026-10-24", "2026-10-24"), 1);
  assert.equal(completionRate([], "2026-10-24", "2026-10-24"), 0);
});

test("completionRate hatalı aralığı reddeder", () => {
  assert.throws(() => completionRate([], "2026-10-24", "2026-10-01"), RangeError);
});
