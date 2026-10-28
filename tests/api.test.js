// API entegrasyon testleri.
// Gerçek HTTP üzerinden konuşuyoruz (fetch), böylece yönlendirme/JSON/durum kodu
// zincirinin tamamı test edilmiş oluyor. Veritabanı bellekte: disk kirletmiyoruz.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";

let app;
let server;
let base;

before(async () => {
  app = createApp({ dbPath: ":memory:", seed: false });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  app.locals.db.close();
});

async function api(path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    contentType: response.headers.get("content-type") ?? "",
    headers: response.headers,
  };
}

let habitId;

test("GET /api/health ayakta mı", async () => {
  const res = await api("/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

/* ------------------------------ CORS ------------------------------ */
// CORS bir sunucu güvenliği değil, tarayıcı politikasıdır: sunucu sadece
// "bu origin'e izin veriyorum" başlığı ekler; kararı tarayıcı uygular.

test("CORS: izinli origin'e Access-Control-Allow-Origin döner", async () => {
  const res = await api("/api/health", {
    headers: { Origin: "https://nezucodes.github.io" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://nezucodes.github.io");
  assert.match(res.headers.get("vary") ?? "", /Origin/i);
});

test("CORS: yerel geliştirme origin'i de izinli", async () => {
  const res = await api("/api/health", {
    headers: { Origin: "http://localhost:4173" },
  });
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:4173");
});

test("CORS: izinsiz origin'e başlık eklenmez (istek yine çalışır)", async () => {
  const res = await api("/api/health", {
    headers: { Origin: "https://kotu-site.example" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});

test("CORS: preflight (OPTIONS) 204 döner, metot ve başlıkları bildirir", async () => {
  const res = await api("/api/habits", {
    method: "OPTIONS",
    headers: {
      Origin: "https://nezucodes.github.io",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://nezucodes.github.io");
  assert.match(res.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(res.headers.get("access-control-allow-headers") ?? "", /Content-Type/i);
});

test("boş veritabanında state boş listeler döner", async () => {
  const res = await api("/api/state");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { habits: [], archived: [], entries: [] });
});

test("boş isim 400 ile reddedilir", async () => {
  const res = await api("/api/habits", { method: "POST", body: { name: "   " } });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /boş olamaz/);
});

test("alışkanlık oluşturma 201 ve varsayılanlarla döner", async () => {
  const res = await api("/api/habits", {
    method: "POST",
    body: { name: "  Su iç  ", emoji: "💧", color: "#8fd3c7" },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, "Su iç"); // trim edildi
  assert.equal(res.body.emoji, "💧");
  assert.equal(res.body.color, "#8fd3c7");
  assert.equal(res.body.archivedAt, null);
  assert.match(res.body.createdAt, /^\d{4}-\d{2}-\d{2}$/);
  habitId = res.body.id;
});

test("state oluşturulan alışkanlığı içerir", async () => {
  const res = await api("/api/state");
  assert.equal(res.body.habits.length, 1);
  assert.equal(res.body.habits[0].id, habitId);
});

test("PATCH sadece verilen alanı değiştirir", async () => {
  const res = await api(`/api/habits/${habitId}`, {
    method: "PATCH",
    body: { name: "2 litre su iç" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, "2 litre su iç");
  assert.equal(res.body.color, "#8fd3c7"); // dokunulmadı
  assert.equal(res.body.emoji, "💧");
});

test("PATCH bilinmeyen id → 404", async () => {
  const res = await api("/api/habits/yok", { method: "PATCH", body: { name: "x" } });
  assert.equal(res.status, 404);
});

test("PATCH boş isim → 400", async () => {
  const res = await api(`/api/habits/${habitId}`, { method: "PATCH", body: { name: "  " } });
  assert.equal(res.status, 400);
});

test("PUT entry işaretler; aynı istek idempotent", async () => {
  const first = await api(`/api/entries/${habitId}/2026-10-27`, {
    method: "PUT",
    body: { done: true },
  });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { habitId, date: "2026-10-27", done: true, note: "" });

  const second = await api(`/api/entries/${habitId}/2026-10-27`, {
    method: "PUT",
    body: { done: true },
  });
  assert.equal(second.status, 200);

  const state = await api("/api/state");
  assert.equal(state.body.entries.length, 1); // kopya yok
});

test("not yazmak işareti bozmaz", async () => {
  const res = await api(`/api/entries/${habitId}/2026-10-27`, {
    method: "PUT",
    body: { note: "1.5 litre oldu" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.done, true); // done gönderilmedi → korundu
  assert.equal(res.body.note, "1.5 litre oldu");
});

test("done:false kaydı siler", async () => {
  const res = await api(`/api/entries/${habitId}/2026-10-27`, {
    method: "PUT",
    body: { done: false },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.done, false);

  const state = await api("/api/state");
  assert.equal(state.body.entries.length, 0);
});

test("geçersiz tarih → 400", async () => {
  const res = await api(`/api/entries/${habitId}/27.10.2026`, {
    method: "PUT",
    body: { done: true },
  });
  assert.equal(res.status, 400);
});

test("bilinmeyen alışkanlığa kayıt → 404", async () => {
  const res = await api("/api/entries/yok/2026-10-27", {
    method: "PUT",
    body: { done: true },
  });
  assert.equal(res.status, 404);
});

test("DELETE arşivler, state'ten düşer", async () => {
  const res = await api(`/api/habits/${habitId}`, { method: "DELETE" });
  assert.equal(res.status, 204);

  const state = await api("/api/state");
  assert.equal(state.body.habits.length, 0);
  assert.equal(state.body.archived.length, 1);
  assert.equal(state.body.archived[0].id, habitId);
  assert.match(state.body.archived[0].archivedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test("restore arşivden geri getirir", async () => {
  const res = await api(`/api/habits/${habitId}/restore`, { method: "POST" });
  assert.equal(res.status, 200);
  assert.equal(res.body.archivedAt, null);

  const state = await api("/api/state");
  assert.equal(state.body.habits.length, 1);
  assert.equal(state.body.archived.length, 0);
});

test("import aynı veriyi iki kez yazmaz", async () => {
  const legacy = {
    habits: [
      { id: "eski-1", name: "Eski alışkanlık", emoji: "📚", color: "#7c8bff", createdAt: "2026-10-01" },
      { id: "eski-2", name: "Bozuk tarih", createdAt: "bozuk" },
      { id: "eski-3" }, // isim yok → atlanır
    ],
    entries: [
      { habitId: "eski-1", date: "2026-10-02", done: true, note: "taşındı" },
      { habitId: "eski-1", date: "bozuk", done: true }, // atlanır
      { habitId: "hayalet", date: "2026-10-03", done: true }, // yabancı anahtar → atlanır
    ],
  };

  const first = await api("/api/import", { method: "POST", body: legacy });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { habitsImported: 2, entriesImported: 1 });

  const second = await api("/api/import", { method: "POST", body: legacy });
  assert.deepEqual(second.body, { habitsImported: 0, entriesImported: 0 });

  const state = await api("/api/state");
  const imported = state.body.habits.find((habit) => habit.id === "eski-1");
  assert.equal(imported.name, "Eski alışkanlık");
  assert.equal(imported.createdAt, "2026-10-01");
  assert.equal(imported.color, "#7c8bff");
  assert.equal(state.body.entries[0].note, "taşındı");
});

test("import aynı isimli iki origin'i tek alışkanlıkta birleştirir", async () => {
  // Senaryo: aynı örnek alışkanlık iki ayrı origin'de farklı id ile oluşmuş.
  const legacy = {
    habits: [
      { id: "o1", name: "Meditasyon", emoji: "🧘", createdAt: "2026-10-05" },
      { id: "o2", name: "  meditasyon  ", emoji: "🧘", createdAt: "2026-10-06" },
    ],
    entries: [
      { habitId: "o1", date: "2026-10-07", done: true, note: "" },
      { habitId: "o2", date: "2026-10-07", done: true, note: "10 dakika" },
      { habitId: "o2", date: "2026-10-08", done: true, note: "" },
    ],
  };

  const first = await api("/api/import", { method: "POST", body: legacy });
  assert.deepEqual(first.body, { habitsImported: 1, entriesImported: 2 });

  const second = await api("/api/import", { method: "POST", body: legacy });
  assert.deepEqual(second.body, { habitsImported: 0, entriesImported: 0 });

  const state = await api("/api/state");
  const matches = state.body.habits.filter((habit) => habit.name.toLowerCase() === "meditasyon");
  assert.equal(matches.length, 1, "aynı isim tek kayıt olmalı");

  const habitEntries = state.body.entries.filter((entry) => entry.habitId === matches[0].id);
  assert.equal(habitEntries.length, 2, "iki günün kaydı da korunmalı");

  const overlap = habitEntries.find((entry) => entry.date === "2026-10-07");
  assert.equal(overlap.done, true);
  assert.equal(overlap.note, "10 dakika", "daha uzun not kazanır");
});

test("export → import round-trip yeni kayıt üretmez", async () => {
  const exported = await api("/api/export");
  assert.equal(exported.status, 200);
  assert.equal(exported.body.app, "aliskanlik-takipci");
  assert.equal(exported.body.version, 1);
  assert.equal(typeof exported.body.exportedAt, "string");
  assert.ok(Array.isArray(exported.body.habits));
  assert.ok(Array.isArray(exported.body.archived));
  assert.ok(Array.isArray(exported.body.entries));

  const before = await api("/api/state");

  const result = await api("/api/import", { method: "POST", body: exported.body });
  assert.deepEqual(result.body, { habitsImported: 0, entriesImported: 0 });

  const after = await api("/api/state");
  assert.deepEqual(after.body, before.body);
});

test("import arşivlenmiş alışkanlığı arşivde tutar", async () => {
  const backup = {
    habits: [],
    archived: [
      {
        id: "arc-1",
        name: "Eski kitap",
        emoji: "📚",
        color: "#7c8bff",
        createdAt: "2026-10-01",
        archivedAt: "2026-10-10",
      },
    ],
    entries: [],
  };

  const result = await api("/api/import", { method: "POST", body: backup });
  assert.deepEqual(result.body, { habitsImported: 1, entriesImported: 0 });

  const state = await api("/api/state");
  const restored = state.body.archived.find((habit) => habit.id === "arc-1");
  assert.ok(restored, "arşiv listesinde olmalı");
  assert.equal(restored.archivedAt, "2026-10-10");
  assert.equal(state.body.habits.some((habit) => habit.id === "arc-1"), false);
});

test("bilinmeyen API yolu JSON 404 döner", async () => {
  const res = await api("/api/yok");
  assert.equal(res.status, 404);
  assert.equal(res.contentType.includes("application/json"), true);
});

test("sunucu ve test klasörleri dışarıya kapalı", async () => {
  for (const path of [
    "/server/app.js",
    "/tests/api.test.js",
    "/scripts/dedupe.js",
    "/node_modules/express/package.json",
  ]) {
    const res = await api(path);
    assert.equal(res.status, 404, `${path} erişilebilir olmamalı`);
  }
});

test("ana sayfa statik olarak servis edilir", async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Alışkanlık Takipçisi/);
});
