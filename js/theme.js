// Tema tercihi: "light" | "dark" | "system".
//
// Kural: tercih saklanır, GERÇEK tema türetilir. "Sistem" seçiliyse
// işletim sisteminin anlık tercihi geçerlidir; kullanıcı sistem temasını
// değiştirdiğinde sayfa da canlı olarak değişir.
//
// DOM'a dokunmayan kısımlar saf fonksiyon: test edilebilir.

const STORAGE_KEY = "ht.theme";
const VALID = ["light", "dark", "system"];

export function normalizePreference(value) {
  return VALID.includes(value) ? value : "system";
}

/** Saf fonksiyon: tercih + sistem durumu → uygulanacak tema. */
export function resolveTheme(preference, systemPrefersDark) {
  const pref = normalizePreference(preference);
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

function systemPrefersDark() {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function getPreference() {
  try {
    return normalizePreference(globalThis.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function applyTheme(preference) {
  const pref = normalizePreference(preference);
  const theme = resolveTheme(pref, systemPrefersDark());

  document.documentElement.dataset.theme = theme;

  // Tarayıcı/PWA çubuğunun rengi de temayla uyumlu olsun.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#10131c" : "#f7f8ff");

  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, pref);
  } catch {
    // Gizli mod / kota dolu: tema yine de uygulanır, sadece hatırlanmaz.
  }

  return pref;
}

/** Açılışta çağrılır: kayıtlı tercihi uygula, sistem değişimini dinle. */
export function initTheme() {
  const media = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  applyTheme(getPreference());

  media?.addEventListener?.("change", () => {
    // Sadece "sistem" modunda otomatik geçiş yap.
    if (getPreference() === "system") applyTheme("system");
  });
}
