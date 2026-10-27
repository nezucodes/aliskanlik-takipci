// Sunucuyu başlatır. `npm run server`
//
// Port neden 4173? localStorage origin'e (host + port) bağlıdır.
// Aşama 0-2'de uygulama 4173'te çalıştığı için eski veriler orada duruyor.
// Aynı portta devam ederek ilk açılışta otomatik taşımayı (migration) mümkün kılıyoruz.

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createApp } from "./app.js";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const dbPath = process.env.DB_PATH ?? join(here, "data", "ht.db");

const app = createApp({ dbPath });

app.listen(port, "127.0.0.1", () => {
  console.log(`Alışkanlık Takipçisi → http://localhost:${port}`);
  console.log(`Veritabanı: ${resolve(dbPath)}`);
});
