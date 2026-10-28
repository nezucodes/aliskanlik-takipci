// Manifest bir JSON dosyası; yazım hatalarını testte yakalamak ucuz ve etkili.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"),
);

test("manifest kurulabilir uygulama için gerekli alanları içerir", () => {
  assert.equal(typeof manifest.name, "string");
  assert.ok(manifest.name.length > 0);
  assert.equal(typeof manifest.short_name, "string");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
});

test("manifest 192, 512 ve 1024 px ikonları tanımlar", () => {
  const sizes = new Set(manifest.icons.map((icon) => icon.sizes));
  assert.ok(sizes.has("192x192"));
  assert.ok(sizes.has("512x512"));
  assert.ok(sizes.has("1024x1024"));
  for (const icon of manifest.icons) {
    assert.equal(icon.type, "image/png");
    // Göreli yol: GitHub Pages alt dizininde de çalışsın (kök "/" kırılır).
    assert.match(icon.src, /^icons\/.+\.png$/);
    assert.ok(!icon.src.startsWith("/"), "kök mutlak yol kullanılmamalı");
  }
});

test("maskable ikon ayrıca tanımlıdır (Android maskeleme)", () => {
  const maskable = manifest.icons.filter((icon) => icon.purpose === "maskable");
  assert.equal(maskable.length, 1);
  assert.equal(maskable[0].sizes, "512x512");
});
