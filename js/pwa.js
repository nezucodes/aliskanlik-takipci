// Service worker kaydı.
// Kayıt yalnızca güvenli bağlamda çalışır: https veya localhost.
// 127.0.0.1 de güvenli sayılır.

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;
  if (!globalThis.isSecureContext) return false;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      // Göreli yol: GitHub Pages alt dizininde de doğru scope'u alır.
      .register("sw.js", { updateViaCache: "none" })
      .catch((error) => console.warn("Service worker kaydedilemedi:", error));
  });

  return true;
}
