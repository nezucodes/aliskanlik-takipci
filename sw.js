// Service worker: uygulama kabuğunu (HTML/CSS/JS/ikon) önbelleğe alır,
// böylece internet (veya sunucu) olmadan da arayüz açılır.
//
// Strateji: NETWORK-FIRST + cache fallback.
//   - Çevrimiçiyken her zaman taze dosya gelir (geliştirirken bayat kod görmezsin).
//   - Çevrimdışıyken son başarılı sürüm önbellekten servis edilir.
//
// API istekleri ASLA önbelleklenmez: kullanıcı verisi bayat olmamalı.
// Yayında API başka bir origin'de olduğu için ilk kontrol zaten onları eler.
//
// Tüm yollar GÖRELİ: uygulama GitHub Pages'te /aliskanlik-takipci/ altında
// çalıştığı için "/index.html" gibi kök yollar yanlış yere işaret eder.
// Göreli yollar service worker'ın kendi konumuna göre çözülür.

const VERSION = "v4";
const CACHE = `ht-shell-${VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/app.js",
  "./js/apiStore.js",
  "./js/config.js",
  "./js/date.js",
  "./js/streak.js",
  "./js/stats.js",
  "./js/theme.js",
  "./js/pwa.js",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Yeni sürüm hemen devralsın (geliştirme kolaylığı).
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API başka origin'de
  if (url.pathname.startsWith("/api/")) return; // yerel API de asla önbelleğe girmez

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Sayfa gezinmesi: kabuğu döndür (SPA gibi davran).
        if (request.mode === "navigate") {
          const shell = await caches.match("./index.html");
          if (shell) return shell;
        }

        return new Response("Çevrimdışısın ve bu dosya önbellekte yok.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
  );
});
