import test from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, isISODate, parseISO, todayISO } from "../js/date.js";

test("isISODate geçerli formatı kabul eder", () => {
  assert.equal(isISODate("2026-10-24"), true);
  assert.equal(isISODate("2028-02-29"), true); // artık yıl
});

test("isISODate takvimde olmayan tarihi reddeder", () => {
  assert.equal(isISODate("2026-02-31"), false);
  assert.equal(isISODate("2027-02-29"), false); // artık yıl değil
  assert.equal(isISODate("2026-13-01"), false);
});

test("isISODate bozuk girdiyi reddeder", () => {
  assert.equal(isISODate(""), false);
  assert.equal(isISODate("24.10.2026"), false);
  assert.equal(isISODate("2026-1-1"), false);
  assert.equal(isISODate(null), false);
  assert.equal(isISODate(20261024), false);
});

test("addDays ay ve yıl sınırını geçer", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-01-01", -1), "2026-12-31");
});

test("addDays artık yılı doğru işler", () => {
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
});

test("addDays yaz saati geçişinde gün kaçırmaz", () => {
  // Avrupa'da saat ileri alınan gece; UTC aritmetiği sayesinde 1 gün = 1 gün.
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
});

test("addDays geçersiz tarihte hata fırlatır", () => {
  assert.throws(() => addDays("2026-02-31", 1), TypeError);
  assert.throws(() => addDays("2026-10-24", 1.5), TypeError);
});

test("daysBetween farkı doğru verir", () => {
  assert.equal(daysBetween("2026-10-01", "2026-10-24"), 23);
  assert.equal(daysBetween("2026-10-24", "2026-10-24"), 0);
  assert.equal(daysBetween("2026-10-24", "2026-10-01"), -23);
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
});

test("todayISO yerel tarihi verir", () => {
  const fake = new Date(2026, 9, 24, 0, 30); // 24 Ekim 2026, 00:30 yerel
  assert.equal(todayISO(fake), "2026-10-24");
});

test("parseISO geçersizde null döner", () => {
  assert.equal(parseISO("2026-02-31"), null);
  assert.equal(parseISO("abc"), null);
});
