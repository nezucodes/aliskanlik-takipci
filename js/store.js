// Veri katmanı — "repository" sözleşmesi (localStorage sürümü).
// Aşama 3'ten itibaren uygulama js/apiStore.js kullanıyor; bu dosya sözleşmenin
// referansı olarak duruyor: aynı fonksiyon isimleri, aynı davranış, farklı depo.
// Hafta 1: localStorage. Hafta 2: fetch ile API.
// Arayüz (app.js) bu dosyanın nasıl çalıştığını bilmez, sadece sözleşmeyi bilir.
// Geriye dönük uyumlu: eski entry'lerde note eksikse boş string olarak dönülür.

import { todayISO } from "./date.js";

const STORAGE_KEY = "ht.v1";

function emptyDB() {
  return { habits: [], entries: [] };
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw);
    return {
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    // Bozuk veri uygulamayı kilitlemesin.
    return emptyDB();
  }
}

function write(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Çok nadir ortamlar için fallback
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function findEntry(db, habitId, date) {
  return db.entries.findIndex((e) => e && e.habitId === habitId && e.date === date);
}

/** Arşivlenmemiş alışkanlıklar. */
export function listHabits() {
  return read()
    .habits.filter((habit) => !habit.archivedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createHabit({ name, emoji = "✅", color = "#6c5ce7" } = {}) {
  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) throw new Error("Alışkanlık adı boş olamaz");

  const db = read();
  const habit = {
    id: newId(),
    name: clean,
    emoji: String(emoji ?? "✅").slice(0, 4),
    color,
    createdAt: todayISO(),
    archivedAt: null,
  };
  db.habits.push(habit);
  write(db);
  return habit;
}

export function renameHabit(id, name) {
  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) throw new Error("Alışkanlık adı boş olamaz");

  const db = read();
  const habit = db.habits.find((item) => item && item.id === id);
  if (!habit) throw new Error("Alışkanlık bulunamadı");
  habit.name = clean;
  write(db);
  return habit;
}

/** Silme = arşivleme. Geçmiş kayıtlar korunur. */
export function deleteHabit(id) {
  const db = read();
  const habit = db.habits.find((item) => item && item.id === id);
  if (!habit) return;
  habit.archivedAt = todayISO();
  write(db);
}

/** İsim / emoji / renk güncelle. Sadece verilen alanlar değişir. */
export function updateHabit(id, patch = {}) {
  const db = read();
  const habit = db.habits.find((item) => item && item.id === id);
  if (!habit) throw new Error("Alışkanlık bulunamadı");

  if (patch.name !== undefined) {
    const clean = String(patch.name ?? "").trim().slice(0, 60);
    if (!clean) throw new Error("Alışkanlık adı boş olamaz");
    habit.name = clean;
  }
  if (patch.emoji !== undefined) habit.emoji = String(patch.emoji ?? "✅").slice(0, 4);
  if (patch.color !== undefined) habit.color = String(patch.color);

  write(db);
  return habit;
}

/** Arşivlenmiş (silinmiş) alışkanlıklar. */
export function listArchivedHabits() {
  return read()
    .habits.filter((habit) => habit && habit.archivedAt)
    .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

/** Arşivden geri getir. */
export function restoreHabit(id) {
  const db = read();
  const habit = db.habits.find((item) => item && item.id === id);
  if (!habit) return null;
  habit.archivedAt = null;
  write(db);
  return habit;
}

/** Tüm tamamlanmış kayıtlar (özet istatistikler için). */
export function listEntries() {
  return read().entries.filter((entry) => entry && entry.done);
}

/** Bir günü işaretle / işareti kaldır. Idempotent: aynı istek iki kez güvenli. */
export function setEntry(habitId, date, done) {
  const db = read();
  const index = findEntry(db, habitId, date);

  if (done && index === -1) {
    db.entries.push({ habitId, date, done: true, note: "" });
  } else if (!done && index !== -1) {
    db.entries.splice(index, 1);
  } else if (done && index !== -1) {
    // Zaten var, notu koru
    if (!db.entries[index]) db.entries[index] = { habitId, date, done: true, note: "" };
    db.entries[index].done = true;
    if (typeof db.entries[index].note !== "string") db.entries[index].note = "";
  }
  write(db);
}

/** İlgili günün entry'sini döndür (varsa). */
export function getEntry(habitId, date) {
  const db = read();
  const entry = db.entries.find((e) => e && e.habitId === habitId && e.date === date);
  if (!entry) return null;
  return {
    habitId: entry.habitId,
    date: entry.date,
    done: Boolean(entry.done),
    note: typeof entry.note === "string" ? entry.note : "",
  };
}

/** Günlük not ekle/düzenle. Not boşsa ve done da false ise entry'yi tutmak yerine silmek istersen
 *  ileride değiştirebiliriz. Şu an "geçmişe bak"ta görünmesi kolay olsun diye entry varsa notu koruyoruz. */
export function setNote(habitId, date, note) {
  const text = String(note ?? "").slice(0, 280);
  const db = read();
  const index = findEntry(db, habitId, date);

  if (index === -1) {
    // Henüz işaretlenmemiş bir güne not yazılabilir (örn. "az yaptım" gibi not)
    db.entries.push({ habitId, date, done: false, note: text });
  } else {
    if (!db.entries[index]) db.entries[index] = { habitId, date, done: false, note: "" };
    db.entries[index].note = text;
    if (typeof db.entries[index].done !== "boolean") db.entries[index].done = false;
  }
  write(db);
}

/** Bir alışkanlığın tamamlanmış günleri (seri hesabı için). */
export function doneDatesFor(habitId) {
  return read()
    .entries.filter((entry) => entry && entry.habitId === habitId && entry.done)
    .map((entry) => entry.date);
}

export function isDone(habitId, date) {
  return read().entries.some((e) => e && e.habitId === habitId && e.date === date && e.done);
}

/** İlk açılışta örnek alışkanlıklar (yalnızca veritabanı boşsa). */
export function seedIfEmpty() {
  const db = read();
  if (db.habits.length > 0) return;

  const defaults = [
    { name: "20 sayfa kitap oku", emoji: "📚", color: "#6c5ce7" },
    { name: "10 dakika yürü", emoji: "🚶", color: "#00b894" },
    { name: "30 dakika kod yaz", emoji: "💻", color: "#e17055" },
  ];
  db.habits.push(
    ...defaults.map((habit) => ({
      id: newId(),
      ...habit,
      createdAt: todayISO(),
      archivedAt: null,
    })),
  );
  write(db);
}
