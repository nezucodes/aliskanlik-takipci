import test from "node:test";
import assert from "node:assert/strict";
import { normalizePreference, resolveTheme } from "../js/theme.js";

test("bilinmeyen/boş tercih 'system'e düşer", () => {
  for (const value of [null, undefined, "", "mor", "DARK", 42]) {
    assert.equal(normalizePreference(value), "system");
  }
});

test("açık tercih, sistem koyu olsa bile açık kalır", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("light", false), "light");
});

test("koyu tercih, sistem açık olsa bile koyu kalır", () => {
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("dark", true), "dark");
});

test("sistem tercihi işletim sistemini izler", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("geçersiz tercih sistem gibi davranır", () => {
  assert.equal(resolveTheme("bozuk", true), "dark");
  assert.equal(resolveTheme("bozuk", false), "light");
});
