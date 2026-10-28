// API + statik dosya sunucusu.
// Tek origin'den servis ettiğimiz için CORS derdi yok.

import express from "express";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { isISODate, todayISO } from "../js/date.js";
import { createDb } from "./db.js";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");

function habitFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    createdAt: row.created_at,
    archivedAt: row.archived_at ?? null,
  };
}

function entryFromRow(row) {
  return {
    habitId: row.habit_id,
    date: row.date,
    done: Boolean(row.done),
    note: row.note ?? "",
  };
}

function cleanName(value) {
  const name = String(value ?? "").trim().slice(0, 60);
  return name || null;
}

function cleanNote(value) {
  return String(value ?? "").slice(0, 280);
}

// seed: testlerde kapalı. Normal çalışmada örnek veriyi istemci ekler,
// böylece localStorage'dan taşınan gerçek veri varsa örnekler onunla karışmaz.
export function createApp({ dbPath = join(here, "data", "ht.db"), seed = false } = {}) {
  const db = createDb(dbPath);
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  const allHabitsStmt = db.prepare(
    "SELECT * FROM habits WHERE archived_at IS NULL ORDER BY created_at, id",
  );
  const archivedHabitsStmt = db.prepare(
    "SELECT * FROM habits WHERE archived_at IS NOT NULL ORDER BY archived_at DESC",
  );
  const allEntriesStmt = db.prepare("SELECT * FROM entries");
  const habitByIdStmt = db.prepare("SELECT * FROM habits WHERE id = ?");
  const entryStmt = db.prepare("SELECT * FROM entries WHERE habit_id = ? AND date = ?");
  const habitCountStmt = db.prepare("SELECT COUNT(*) AS count FROM habits");

  if (seed && habitCountStmt.get().count === 0) {
    const insert = db.prepare(
      "INSERT INTO habits (id, name, emoji, color, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    const defaults = [
      ["20 sayfa kitap oku", "📚", "#7c8bff"],
      ["10 dakika yürü", "🚶", "#8fd3c7"],
      ["30 dakika kod yaz", "💻", "#f7b7a3"],
    ];
    for (const [name, emoji, color] of defaults) {
      insert.run(randomUUID(), name, emoji, color, todayISO());
    }
  }

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  // Tek istekte tüm durum: habits + archived + entries.
  // N+1 istek problemini baştan engelliyoruz.
  app.get("/api/state", (req, res) => {
    res.json({
      habits: allHabitsStmt.all().map(habitFromRow),
      archived: archivedHabitsStmt.all().map(habitFromRow),
      entries: allEntriesStmt.all().map(entryFromRow),
    });
  });

  app.post("/api/habits", (req, res) => {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: "Alışkanlık adı boş olamaz" });

    const habit = {
      id: randomUUID(),
      name,
      emoji: String(req.body?.emoji ?? "✅").slice(0, 4),
      color: String(req.body?.color ?? "#7c8bff"),
      createdAt: todayISO(),
    };

    db.prepare(
      "INSERT INTO habits (id, name, emoji, color, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(habit.id, habit.name, habit.emoji, habit.color, habit.createdAt);

    res.status(201).json({ ...habit, archivedAt: null });
  });

  app.patch("/api/habits/:id", (req, res) => {
    const row = habitByIdStmt.get(req.params.id);
    if (!row) return res.status(404).json({ error: "Alışkanlık bulunamadı" });

    const current = habitFromRow(row);
    const name = req.body?.name === undefined ? current.name : cleanName(req.body.name);
    if (!name) return res.status(400).json({ error: "Alışkanlık adı boş olamaz" });

    const emoji = req.body?.emoji === undefined ? current.emoji : String(req.body.emoji).slice(0, 4);
    const color = req.body?.color === undefined ? current.color : String(req.body.color);

    db.prepare("UPDATE habits SET name = ?, emoji = ?, color = ? WHERE id = ?").run(
      name,
      emoji,
      color,
      current.id,
    );

    res.json({ ...current, name, emoji, color });
  });

  // Silme = arşivleme. Geçmiş kayıtlar korunur.
  app.delete("/api/habits/:id", (req, res) => {
    const row = habitByIdStmt.get(req.params.id);
    if (!row) return res.status(404).json({ error: "Alışkanlık bulunamadı" });

    db.prepare("UPDATE habits SET archived_at = ? WHERE id = ?").run(todayISO(), row.id);
    res.status(204).end();
  });

  app.post("/api/habits/:id/restore", (req, res) => {
    const row = habitByIdStmt.get(req.params.id);
    if (!row) return res.status(404).json({ error: "Alışkanlık bulunamadı" });

    db.prepare("UPDATE habits SET archived_at = NULL WHERE id = ?").run(row.id);
    res.json(habitFromRow(habitByIdStmt.get(row.id)));
  });

  /**
   * Bir günü işaretle / not yaz.
   * Gövde: { done?: boolean, note?: string }
   * - done:false → kaydı siler (localStorage sürümüyle aynı davranış)
   * - gönderilmeyen alan mevcut değerini korur
   */
  app.put("/api/entries/:habitId/:date", (req, res) => {
    const { habitId, date } = req.params;
    if (!isISODate(date)) return res.status(400).json({ error: "Tarih YYYY-MM-DD olmalı" });

    const habit = habitByIdStmt.get(habitId);
    if (!habit) return res.status(404).json({ error: "Alışkanlık bulunamadı" });

    if (req.body?.done === false) {
      db.prepare("DELETE FROM entries WHERE habit_id = ? AND date = ?").run(habitId, date);
      return res.json({ habitId, date, done: false, note: "" });
    }

    const existing = entryStmt.get(habitId, date);
    const done = req.body?.done === undefined ? Boolean(existing?.done) : Boolean(req.body.done);
    const note =
      req.body?.note === undefined ? (existing?.note ?? "") : cleanNote(req.body.note);

    db.prepare(
      `INSERT INTO entries (habit_id, date, done, note) VALUES (?, ?, ?, ?)
       ON CONFLICT(habit_id, date) DO UPDATE SET done = excluded.done, note = excluded.note`,
    ).run(habitId, date, done ? 1 : 0, note);

    res.json({ habitId, date, done, note });
  });

  app.get("/api/entries/:habitId/:date", (req, res) => {
    const row = entryStmt.get(req.params.habitId, req.params.date);
    if (!row) return res.status(404).json({ error: "Kayıt yok" });
    res.json(entryFromRow(row));
  });

  // Yedek: tek dosyada tam durum. `version` ileride format değişirse işe yarar.
  // Aynı dosya /api/import'a geri verilebilir (round-trip).
  app.get("/api/export", (req, res) => {
    res.json({
      app: "aliskanlik-takipci",
      version: 1,
      exportedAt: new Date().toISOString(),
      habits: allHabitsStmt.all().map(habitFromRow),
      archived: archivedHabitsStmt.all().map(habitFromRow),
      entries: allEntriesStmt.all().map(entryFromRow),
    });
  });

  // localStorage'dan tek seferlik taşıma.
  //
  // Kimlik kuralı: id değil, İSİM. Aynı isim daha önce taşındıysa yeni kayıt
  // açmıyoruz; gelen kayıtları var olan alışkanlığa bağlıyoruz. Bu, aynı örnek
  // verinin iki farklı origin'den (localhost + 127.0.0.1) taşınmasıyla oluşan
  // kopyaları engeller. Aynı güne düşen kayıtlar bilgi kaybetmeden birleşir:
  // işaretlerden biri true ise true kalır, daha uzun not kazanır.
  app.post("/api/import", (req, res) => {
    const incomingHabits = Array.isArray(req.body?.habits) ? req.body.habits : [];
    const archivedHabits = Array.isArray(req.body?.archived) ? req.body.archived : [];
    // Dışa aktardığımız dosya "archived" ayrı tutar; içe aktarırken aynı listeye katarız.
    const habits = [...incomingHabits, ...archivedHabits];
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];

    const insertHabit = db.prepare(
      `INSERT OR IGNORE INTO habits (id, name, emoji, color, created_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertEntry = db.prepare(
      "INSERT INTO entries (habit_id, date, done, note) VALUES (?, ?, ?, ?)",
    );
    const mergeEntry = db.prepare(
      `UPDATE entries
          SET done = MAX(done, ?),
              note = CASE WHEN length(?) > length(note) THEN ? ELSE note END
        WHERE habit_id = ? AND date = ?`,
    );
    const habitIdByNameStmt = db.prepare(
      `SELECT id FROM habits
        WHERE lower(trim(name)) = lower(trim(?))
        ORDER BY (archived_at IS NOT NULL), created_at
        LIMIT 1`,
    );

    let habitsImported = 0;
    let entriesImported = 0;
    const idMap = new Map();

    db.exec("BEGIN");
    try {
      for (const habit of habits) {
        const name = cleanName(habit?.name);
        if (!habit?.id || !name) continue;

        const sourceId = String(habit.id);
        // Aynı id veya aynı isim zaten varsa onu kullan (kopya açma).
        const existing = habitByIdStmt.get(sourceId) ?? habitIdByNameStmt.get(name);
        if (existing) {
          idMap.set(sourceId, existing.id);
          continue;
        }

        const result = insertHabit.run(
          sourceId,
          name,
          String(habit.emoji ?? "✅").slice(0, 4),
          String(habit.color ?? "#7c8bff"),
          isISODate(habit.createdAt) ? habit.createdAt : todayISO(),
          isISODate(habit.archivedAt) ? habit.archivedAt : null,
        );
        habitsImported += result.changes;
        idMap.set(sourceId, sourceId);
      }

      for (const entry of entries) {
        if (!entry?.habitId || !isISODate(entry.date)) continue;

        // Yabancı anahtar: kaynağı ne taşınmış ne de var olan alışkanlığa bağlanamıyorsa atla.
        const targetId =
          idMap.get(String(entry.habitId)) ?? habitByIdStmt.get(String(entry.habitId))?.id;
        if (!targetId) continue;

        const done = entry.done ? 1 : 0;
        const note = cleanNote(entry.note);

        if (!entryStmt.get(targetId, entry.date)) {
          insertEntry.run(targetId, entry.date, done, note);
          entriesImported += 1;
        } else {
          mergeEntry.run(done, note, note, targetId, entry.date);
        }
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    res.json({ habitsImported, entriesImported });
  });

  // Statik dosyalar: sunucu klasörü, testler ve araçlar dışarıdan erişilemesin.
  app.use((req, res, next) => {
    if (/^\/(server|tests|scripts|node_modules|\.git)(\/|$)/.test(req.path)) {
      return res.status(404).json({ error: "Bulunamadı" });
    }
    next();
  });
  app.use(express.static(projectRoot, { index: "index.html" }));

  app.use((req, res) => {
    res.status(404).json({ error: "Bulunamadı" });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: "Sunucu hatası" });
  });

  app.locals.db = db;
  return app;
}
