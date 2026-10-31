// Service worker kaydı.
// Kayıt yalnızca güvenli bağlamda çalışır: https veya localhost.
// 127.0.0.1 de güvenli sayılır.

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;
  if (!globalThis.isSecureContext) return false;

  // Sayfa ilk kez mi açıldı? İlk kurulumda "controllerchange" normaldir;
  // gereksiz yere "yeni sürüm" uyarısı göstermeyelim.
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Yeni service worker devraldı ama sayfa hâlâ eski dosyalarla çalışıyor.
    // Kendiliğinden yenilemiyoruz (kullanıcı form yazıyor olabilir); bandı gösteriyoruz.
    if (!hadController) return;
    window.dispatchEvent(new CustomEvent("ht:update-ready"));
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      // Göreli yol: GitHub Pages alt dizininde de doğru scope'u alır.
      .register("sw.js", { updateViaCache: "none" })
      .catch((error) => console.warn("Service worker kaydedilemedi:", error));
  });

  return true;
}
