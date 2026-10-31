// Service worker'ın precache listesi ile diskteki dosyalar eşleşmeli:
// eksik tek dosya install'ı komple düşürür (atomik addAll).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(join(root, "sw.js"), "utf8");

function precachePaths() {
  const block = source.match(/const PRECACHE = \[([\s\S]*?)\];/);
  assert.ok(block, "PRECACHE listesi bulunamadı");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

test("precache listesindeki her dosya diskte var", () => {
  for (const path of precachePaths()) {
    const relative = path === "./" ? "index.html" : path.replace(/^\.\//, "");
    assert.ok(existsSync(join(root, relative)), `${path} diskte yok`);
  }
});

test("önbellek sürümü tanımlı", () => {
  assert.match(source, /const VERSION = "v\d+"/);
});

test("kurulum ve istekler HTTP önbelleğini atlar", () => {
  // GitHub Pages max-age=600 veriyor; atlanmazsa yeni app.js ile eski
  // stats.js yan yana gelebiliyor ve modül import'u patlıyor.
  assert.match(source, /cache: "reload"/);
  assert.match(source, /cache: "no-store"/);
});
