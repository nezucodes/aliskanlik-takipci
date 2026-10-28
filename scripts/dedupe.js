// Aynı isimli alışkanlıkları tek kayıtta birleştirir.
//
// Neden gerekli?
// localStorage origin'e (host + port) bağlıdır. Uygulama hem localhost:4173
// hem 127.0.0.1:4173 üzerinden açıldıysa iki ayrı depo oluşur. İkisinde de
// aynı isimli örnek alışkanlıklar farklı id'lerle durur. Taşıma sırasında
// id'ler farklı olduğu için aynı alışkanlık iki kez eklenmiş olur.
//
// Bu araç isim bazında gruplar, geçmiş kayıtları (entries) birleştirir ve
// kopyaları siler. Veritabanını değiştirmeden önce yedek alır.
//
// Kullanım:
//   npm run dedupe          → yedek al + birleştir
//   npm run dedupe -- --dry → sadece raporla, hiçbir şey yazma

import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.env.DB_PATH ?? join(here, "..", "server", "data", "ht.db"));
const dryRun = process.argv.includes("--dry");

if (!existsSync(dbPath)) {
  console.error(`Veritabanı bulunamadı: ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");

const habits = db
  .prepare("SELECT id, name, emoji, created_at, archived_at FROM habits ORDER BY created_at, id")
  .all();

const entriesForHabit = (id) =>
  db.prepare("SELECT date, done, note FROM entries WHERE habit_id = ? ORDER BY date").all(id);

// İsim = kimlik. Büyük/küçük harf ve baştaki/sondaki boşluk farkı önemsiz.
const byName = new Map();
for (const habit of habits) {
  const key = habit.name.trim().toLowerCase();
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(habit);
}

const groups = [...byName.values()].filter((group) => group.length > 1);

console.log(`Veritabanı: ${dbPath}`);
console.log(`Alışkanlık: ${habits.length} · Grup (aynı isim): ${groups.length}`);
console.log("");

if (groups.length === 0) {
  console.log("Birleştirilecek kopya yok. Hiçbir şey değişmedi.");
  db.close();
  process.exit(0);
}

// Hangi kopya kalacak? Önce arşivde olmayan, sonra en eski oluşturulan.
function keeperOrder(a, b) {
  const archivedA = a.archived_at ? 1 : 0;
  const archivedB = b.archived_at ? 1 : 0;
  if (archivedA !== archivedB) return archivedA - archivedB;
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

const plans = [];
for (const group of groups) {
  group.sort(keeperOrder);
  const keeper = group[0];

  const merged = new Map();
  let rowsBefore = 0;
  let conflicts = 0;

  for (const habit of group) {
    for (const row of entriesForHabit(habit.id)) {
      rowsBefore += 1;
      const current = merged.get(row.date);
      if (!current) {
        merged.set(row.date, { done: row.done, note: row.note ?? "" });
        continue;
      }
      conflicts += 1;
      merged.set(row.date, {
        // Aynı gün iki kopyada işaretliyse işaret korunur.
        done: Math.max(current.done, row.done),
        // Not: daha uzun olan kazanır (boş not, dolu notu ezmesin).
        note: (row.note ?? "").length > current.note.length ? row.note : current.note,
      });
    }
  }

  // Ne işaretli ne notlu kayıt hiçbir bilgi taşımıyor.
  let emptyRemoved = 0;
  for (const [date, value] of merged) {
    if (!value.done && value.note.trim() === "") {
      merged.delete(date);
      emptyRemoved += 1;
    }
  }

  plans.push({
    keeper,
    duplicates: group.slice(1),
    merged,
    rowsBefore,
    conflicts,
    emptyRemoved,
  });

  console.log(`• "${keeper.name}"`);
  console.log(
    `  ${group.length} kopya → 1 · ${rowsBefore} kayıt → ${merged.size} kayıt` +
      (conflicts ? ` · ${conflicts} çakışan gün birleştirildi` : "") +
      (emptyRemoved ? ` · ${emptyRemoved} boş kayıt atıldı` : ""),
  );
  if (group[0].archived_at === null && group.some((habit) => habit.archived_at)) {
    console.log("  (arşivdeki kopya aktif olanla birleştirildi)");
  }
}

const totalRemoved = plans.reduce((sum, plan) => sum + plan.duplicates.length, 0);
const totalEntries = plans.reduce((sum, plan) => sum + plan.merged.size, 0);

if (dryRun) {
  console.log("");
  console.log(`--dry: hiçbir şey yazılmadı. Uygulamak için: npm run dedupe`);
  db.close();
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `${dbPath}.bak-${stamp}`;
copyFileSync(dbPath, backupPath);

const insertEntry = db.prepare(
  "INSERT INTO entries (habit_id, date, done, note) VALUES (?, ?, ?, ?)",
);
const deleteEntries = db.prepare("DELETE FROM entries WHERE habit_id = ?");
const deleteHabit = db.prepare("DELETE FROM habits WHERE id = ?");

db.exec("BEGIN");
try {
  for (const plan of plans) {
    for (const habit of [plan.keeper, ...plan.duplicates]) {
      deleteEntries.run(habit.id);
    }
    for (const habit of plan.duplicates) {
      deleteHabit.run(habit.id);
    }
    for (const [date, value] of plan.merged) {
      insertEntry.run(plan.keeper.id, date, value.done, value.note);
    }
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  db.close();
  console.error("Birleştirme başarısız, hiçbir değişiklik yapılmadı:", error.message);
  process.exit(1);
}

const remaining = db.prepare("SELECT COUNT(*) AS c FROM habits").get().c;

console.log("");
console.log(
  `Özet: ${plans.length} grup birleştirildi · ${totalRemoved} kopya silindi · ${totalEntries} kayıt korundu`,
);
console.log(`Kalan alışkanlık: ${remaining}`);
console.log(`Yedek: ${backupPath}`);

db.close();
