// Yayın (deploy) yapılandırması.
//
// Sorun: geliştirmede arayüz ve API aynı origin'de (http://localhost:4173).
// Yayında ise arayüz GitHub Pages'te, API ayrı bir host'ta olacak.
// Yani isteklerin nereye gideceği ortama göre değişmeli.
//
// Neden kod içinde algılama? Projede bilinçli olarak build adımı yok.
// Build olsaydı (Vite/webpack) bu değer `import.meta.env.VITE_API_URL` gibi
// bir ortam değişkeninden gelirdi ve kodda sabit URL olmazdı.
// Build'siz projede en sade çözüm: host'a bakmak.
//
// `localhost` / `127.0.0.1` → aynı origin (göreli istek, CORS yok)
// başka her yer           → yayındaki API (CORS devrede)

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

// Render'daki servis adı. Servis adını değiştirirsen burayı da güncelle.
export const API_BASE = LOCAL_HOSTS.has(globalThis.location?.hostname ?? "")
  ? ""
  : "https://aliskanlik-api.onrender.com";

export const API_ROOT = `${API_BASE}/api`;
