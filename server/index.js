// Sunucuyu başlatır. `npm run server`
//
// Port neden 4173? localStorage origin'e (host + port) bağlıdır.
// Aşama 0-2'de uygulama 4173'te çalıştığı için eski veriler orada duruyor.
// Aynı portta devam ederek ilk açılışta otomatik taşımayı (migration) mümkün kılıyoruz.
//
// Yayında (Render) iki şey değişir:
//   - PORT: platform kendi portunu verir (process.env.PORT).
//   - HOST: konteyner dışarıdan erişilebilir olmalı → 0.0.0.0.
//     Yerelde 127.0.0.1'e bağlanmak daha güvenli (ağdaki başkaları erişemez).

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createApp, parseAllowedOrigins } from "./app.js";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const dbPath = process.env.DB_PATH ?? join(here, "data", "ht.db");

const extraOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const host = process.env.HOST ?? (process.env.PORT ? "0.0.0.0" : "127.0.0.1");

const app = createApp({
  dbPath,
  ...(extraOrigins.length > 0 ? { allowedOrigins: extraOrigins } : {}),
});

app.listen(port, host, () => {
  console.log(`Alışkanlık Takipçisi → http://localhost:${port}`);
  console.log(`Veritabanı: ${resolve(dbPath)}`);
  console.log(`Dinlenen adres: ${host}:${port}`);
});
