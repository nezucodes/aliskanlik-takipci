// Veri katmanı — aynı "repository" sözleşmesi, farklı uygulama.
// store.js (localStorage) ile aynı fonksiyon isimleri; içi artık fetch.
//
// Tasarım kararı:
//  - OKUMA senkron: veri açılışta bir kez çekilip bellekte tutulur ("snapshot").
//    Böylece render() her karede 90 gün × N alışkanlık için ağ isteği atmaz.
//  - YAZMA asenkron: fetch başarılı olursa snapshot güncellenir, sonra render edilir.
//    Bu, "sunucu doğruyu söyler" ilkesidir; iyimser (optimistic) güncelleme yapmıyoruz
//    çünkü hata durumunda arayüzün yalan söylemesini istemiyoruz.

import { todayISO } from "./date.js";

const API_ROOT = "/api";
const LEGACY_KEY = "ht.v1";
const MIGRATED_KEY = "ht.migrated.v1";

let snapshot = { habits: [], archived: [], entries: [] };
let loaded = false;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Ağ hatası: sunucu kapalı, DNS yok, offline...
    throw new ApiError("Sunucuya ulaşılamadı. Terminalde `npm run server` çalışıyor mu?", 0);
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // 502/503/504: arada bir vekil (proxy) var ama arkadaki sunucu kapalı.
    const unreachable = response.status >= 502 && response.status <= 504;
    const fallback = unreachable
      ? "Sunucuya ulaşılamadı. Terminalde `npm run server` çalışıyor mu?"
      : `İstek başarısız (HTTP ${response.status})`;
    throw new ApiError(data?.error ?? fallback, response.status);
  }
  return data;
}

function normalize(data) {
  return {
    habits: Array.isArray(data?.habits) ? data.habits : [],
    archived: Array.isArray(data?.archived) ? data.archived : [],
    entries: Array.isArray(data?.entries) ? data.entries : [],
  };
}

/* ------------------------------------------------------------------ */
/* Eski localStorage verisini tek seferlik taşıma                      */
/* ------------------------------------------------------------------ */

function readLegacy() {
  try {
    const raw = globalThis.localStorage?.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const habits = Array.isArray(parsed?.habits) ? parsed.habits : [];
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    if (habits.length === 0 && entries.length === 0) return null;
    return { habits, entries };
  } catch {
    return null;
  }
}

async function migrateLegacyOnce() {
  if (!globalThis.localStorage) return false;
  if (localStorage.getItem(MIGRATED_KEY)) return false;

  const legacy = readLegacy();
  if (!legacy) {
    localStorage.setItem(MIGRATED_KEY, "1");
    return false;
  }

  await request("/import", { method: "POST", body: legacy });
  localStorage.setItem(MIGRATED_KEY, "1");
  return true;
}

/* ------------------------------------------------------------------ */
/* Okuma — senkron, bellekten                                          */
/* ------------------------------------------------------------------ */

export function isLoaded() {
  return loaded;
}

/** Açılışta bir kez: tüm durumu çek, eski veriyi taşı. */
export async function loadState() {
  let data = await request("/state");

  if (await migrateLegacyOnce()) {
    data = await request("/state");
  }

  snapshot = normalize(data);
  loaded = true;
  return snapshot;
}

/** Arşivlenmemiş alışkanlıklar (sunucu sıralı gönderir). */
export function listHabits() {
  return snapshot.habits;
}

/** Arşivlenmiş alışkanlıklar. */
export function listArchivedHabits() {
  return snapshot.archived;
}

/** Tüm tamamlanmış kayıtlar (özet istatistikler için). */
export function listEntries() {
  return snapshot.entries.filter((entry) => entry && entry.done);
}

export function getEntry(habitId, date) {
  const entry = snapshot.entries.find((item) => item && item.habitId === habitId && item.date === date);
  return entry ?? null;
}

export function isDone(habitId, date) {
  const entry = getEntry(habitId, date);
  return Boolean(entry?.done);
}

/** Bir alışkanlığın tamamlanmış günleri (seri hesabı için). */
export function doneDatesFor(habitId) {
  return snapshot.entries
    .filter((entry) => entry && entry.habitId === habitId && entry.done)
    .map((entry) => entry.date);
}

/* ------------------------------------------------------------------ */
/* Yazma — asenkron, sunucu + snapshot                                 */
/* ------------------------------------------------------------------ */

function upsertEntry(entry) {
  const index = snapshot.entries.findIndex(
    (item) => item.habitId === entry.habitId && item.date === entry.date,
  );
  if (index === -1) snapshot.entries.push(entry);
  else snapshot.entries[index] = entry;
}

function removeEntry(habitId, date) {
  snapshot.entries = snapshot.entries.filter(
    (item) => !(item.habitId === habitId && item.date === date),
  );
}

function takeHabit(list, id) {
  const index = list.findIndex((habit) => habit.id === id);
  if (index === -1) return null;
  return list.splice(index, 1)[0];
}

export async function createHabit({ name, emoji = "✅", color = "#7c8bff" } = {}) {
  const habit = await request("/habits", {
    method: "POST",
    body: { name, emoji, color },
  });
  snapshot.habits.push(habit);
  return habit;
}

/** İsim / emoji / renk güncelle. Sadece verilen alanlar değişir. */
export async function updateHabit(id, patch = {}) {
  const habit = await request(`/habits/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
  const index = snapshot.habits.findIndex((item) => item.id === id);
  if (index !== -1) snapshot.habits[index] = habit;
  else {
    const archivedIndex = snapshot.archived.findIndex((item) => item.id === id);
    if (archivedIndex !== -1) snapshot.archived[archivedIndex] = habit;
  }
  return habit;
}

/** Silme = arşivleme. Geçmiş kayıtlar korunur. */
export async function deleteHabit(id) {
  await request(`/habits/${encodeURIComponent(id)}`, { method: "DELETE" });
  const habit = takeHabit(snapshot.habits, id);
  if (habit) {
    habit.archivedAt = todayISO();
    snapshot.archived.unshift(habit);
  }
}

/** Arşivden geri getir. */
export async function restoreHabit(id) {
  const habit = await request(`/habits/${encodeURIComponent(id)}/restore`, { method: "POST" });
  takeHabit(snapshot.archived, id);
  snapshot.habits.push(habit);
  return habit;
}

/** Bir günü işaretle / işareti kaldır. Idempotent: aynı istek iki kez güvenli. */
export async function setEntry(habitId, date, done) {
  const entry = await request(`/entries/${encodeURIComponent(habitId)}/${date}`, {
    method: "PUT",
    body: { done: Boolean(done) },
  });
  if (entry.done) upsertEntry(entry);
  else removeEntry(habitId, date);
  return entry;
}

/** Günlük not. Gövdede done yok → sunucu mevcut işareti korur. */
export async function setNote(habitId, date, note) {
  const entry = await request(`/entries/${encodeURIComponent(habitId)}/${date}`, {
    method: "PUT",
    body: { note },
  });
  upsertEntry(entry);
  return entry;
}

/** İlk açılışta örnek alışkanlıklar (yalnızca sunucu tamamen boşsa). */
export async function seedIfEmpty() {
  if (snapshot.habits.length > 0 || snapshot.archived.length > 0) return;

  const defaults = [
    { name: "20 sayfa kitap oku", emoji: "📚", color: "#7c8bff" },
    { name: "10 dakika yürü", emoji: "🚶", color: "#8fd3c7" },
    { name: "30 dakika kod yaz", emoji: "💻", color: "#f7b7a3" },
  ];
  for (const habit of defaults) {
    // Sırayla: created_at aynı olsa da liste düzeni korunsun.
    // eslint-disable-next-line no-await-in-loop
    await createHabit(habit);
  }
}
