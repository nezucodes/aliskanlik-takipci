// Tarih yardımcıları.
// Kural: tarih her zaman YYYY-MM-DD string'i. Saat dilimi derdi yok.
// Hesaplamalar UTC üzerinden yapılır ki yaz saati geçişlerinde gün kaymasın.
// Debug: ?debug=YYYY-MM-DD ile "bugünü" sahteleyebilirsin.

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

let debugToday = null;

function readDebugFromURL() {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const v = url.searchParams.get("debug");
    if (isISODate(v)) return v;
  } catch {
    // ignore
  }
  return null;
}

if (typeof window !== "undefined") {
  debugToday = readDebugFromURL();
  // Konsoldan kolayca değiştirmek için global
  window.__htDebug = {
    get() {
      return debugToday;
    },
    set(iso) {
      if (iso === null || iso === undefined) {
        debugToday = null;
        const url = new URL(window.location.href);
        url.searchParams.delete("debug");
        history.replaceState({}, "", url);
        return;
      }
      if (!isISODate(iso)) throw new Error("Geçersiz tarih, YYYY-MM-DD olmalı");
      debugToday = iso;
      const url = new URL(window.location.href);
      url.searchParams.set("debug", iso);
      history.replaceState({}, "", url);
    },
    clear() {
      debugToday = null;
      const url = new URL(window.location.href);
      url.searchParams.delete("debug");
      history.replaceState({}, "", url);
    },
  };
}

/**
 * "YYYY-MM-DD" → UTC milisaniye. Geçersizse null.
 * 2026-02-31 gibi "takvimde olmayan" tarihleri de reddeder.
 */
export function parseISO(iso) {
  const match = typeof iso === "string" ? ISO_RE.exec(iso) : null;
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);

  const roundTrip =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return roundTrip ? ms : null;
}

/** Değer geçerli bir YYYY-MM-DD mi? */
export function isISODate(value) {
  return parseISO(value) !== null;
}

/** Yerel saatle bugünün tarihi. (Kullanıcının gördüğü "bugün".) Debug modunda URL'den override edilebilir. */
export function todayISO(now = new Date()) {
  if (debugToday) return debugToday;
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Aktif "bugün" değerini döndür (debug dahil). */
export function getActiveToday(now = new Date()) {
  return todayISO(now);
}

/** Debug modunda mıyız? */
export function isDebugToday() {
  return Boolean(debugToday);
}

/** Tarihe gün ekler/çıkarır. addDays("2026-03-28", 1) → "2026-03-29" */
export function addDays(iso, days) {
  const ms = parseISO(iso);
  if (ms === null) throw new TypeError(`Geçersiz tarih: ${iso}`);
  if (!Number.isInteger(days)) throw new TypeError(`Gün tam sayı olmalı: ${days}`);

  const date = new Date(ms + days * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** İki tarih arasındaki gün farkı (b - a). */
export function daysBetween(aISO, bISO) {
  const a = parseISO(aISO);
  const b = parseISO(bISO);
  if (a === null || b === null) throw new TypeError("Geçersiz tarih");
  return Math.round((b - a) / MS_PER_DAY);
}

/** Ekranda gösterim için: "24 Ekim 2026 Cumartesi" */
export function formatTR(iso) {
  const ms = parseISO(iso);
  if (ms === null) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "full",
    timeZone: "UTC", // parseISO zaten UTC'ye sabitledi; kaymasın
  }).format(new Date(ms));
}
