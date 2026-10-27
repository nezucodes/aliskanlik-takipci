// SQLite bağlantısı ve şema.
// Node 26'nın yerleşik node:sqlite modülünü kullanıyoruz: ekstra bağımlılık yok.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function createDb(dbPath) {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // WAL: aynı anda okuma/yazma için daha iyi davranış.
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS habits (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      emoji       TEXT NOT NULL DEFAULT '✅',
      color       TEXT NOT NULL DEFAULT '#7c8bff',
      created_at  TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS entries (
      habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      date     TEXT NOT NULL,
      done     INTEGER NOT NULL DEFAULT 0,
      note     TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (habit_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
  `);

  return db;
}
