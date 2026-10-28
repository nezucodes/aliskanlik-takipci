// Uygulama ikonlarını sıfırdan üretir.
//
// Neden? Grafik aracı (Figma/ImageMagick) yok. PNG aslında:
//   imza + IHDR (boyut) + IDAT (zlib ile sıkıştırılmış pikseller) + IEND
// parçalarından oluşan bir dosya. Burada onu doğrudan yazıyoruz.
//
// Çizim: yuvarlak köşeli pastel kare + beyaz tik işareti.
// Kenarlar 4×4 süper örnekleme ile yumuşatılıyor (anti-aliasing).
//
// Kullanım: node scripts/make-icons.js

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "icons");

/* ---------------- PNG yazıcı ---------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 6; // renk türü: RGBA
  ihdr[10] = 0; // sıkıştırma
  ihdr[11] = 0; // filtre
  ihdr[12] = 0; // interlace yok

  // Her satırın başına filtre baytı (0 = filtre yok) eklenir.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------------- Çizim ---------------- */

const SS = 4; // süper örnekleme: 1 piksel = 4×4 örnek

function roundedRectSdf(px, py, size, radius) {
  const half = size / 2;
  const qx = Math.abs(px - half) - (half - radius);
  const qy = Math.abs(py - half) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function renderIcon(size, { rounded = true, scale = 1 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = rounded ? size * 0.22 : 0;

  // Tik işareti: üç nokta, kalınlık sabit.
  const stroke = size * 0.085;
  const center = size / 2;
  const put = (nx, ny) => [center + (nx - 0.5) * size * scale, center + (ny - 0.5) * size * scale];
  const [ax, ay] = put(0.29, 0.53);
  const [bx, by] = put(0.44, 0.67);
  const [cx, cy] = put(0.72, 0.35);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bg = 0;
      let mark = 0;

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;

          if (!rounded || roundedRectSdf(px, py, size, radius) <= 0) bg += 1;

          const d = Math.min(
            segmentDistance(px, py, ax, ay, bx, by),
            segmentDistance(px, py, bx, by, cx, cy),
          );
          if (d <= stroke / 2) mark += 1;
        }
      }

      const samples = SS * SS;
      const bgAlpha = bg / samples;
      const markAlpha = mark / samples;

      // Köşegen pastel gradyan.
      const t = (x + y) / (2 * size);
      let r = Math.round(139 + (111 - 139) * t);
      let g = Math.round(151 + (124 - 151) * t);
      let b = Math.round(255 + (240 - 255) * t);

      // Beyaz tik, arka planın üstüne bindirilir.
      r = Math.round(r * (1 - markAlpha) + 255 * markAlpha);
      g = Math.round(g * (1 - markAlpha) + 255 * markAlpha);
      b = Math.round(b * (1 - markAlpha) + 255 * markAlpha);

      const index = (y * size + x) * 4;
      rgba[index] = r;
      rgba[index + 1] = g;
      rgba[index + 2] = b;
      rgba[index + 3] = Math.round(255 * Math.max(bgAlpha, markAlpha * bgAlpha));
    }
  }

  return rgba;
}

/* ---------------- Çıktı ---------------- */

mkdirSync(outDir, { recursive: true });

const outputs = [
  // Sekme ikonu: küçük boyutta yuvarlak köşe daha okunaklı.
  { file: "favicon-32.png", size: 32, rounded: true, scale: 1 },
  // Uygulama ikonları: TAM DOLU (köşe yuvarlatması yok).
  // Neden? macOS/iOS/Android ikonu kendi maskeleriyle yuvarlıyor.
  // Biz de yuvarlarsak "çift maske" olur ve platform ikonu büyütüp kırpar;
  // tik olduğundan büyük ve kenara yakın görünür.
  { file: "icon-192.png", size: 192, rounded: false, scale: 0.86 },
  { file: "icon-512.png", size: 512, rounded: false, scale: 0.86 },
  // Retina Dock/Launchpad 1024 px'e kadar kaynak ister; yoksa 512'yi büyütüp bulanıklaştırır.
  { file: "icon-1024.png", size: 1024, rounded: false, scale: 0.86 },
  // Maskable: platform kendi maskesini uygular → tam dolu zemin + güvenli alan.
  { file: "icon-maskable-512.png", size: 512, rounded: false, scale: 0.78 },
  // iOS kendi köşe maskesini uygular → tam dolu zemin.
  { file: "apple-touch-icon-180.png", size: 180, rounded: false, scale: 0.86 },
];

for (const { file, size, rounded, scale } of outputs) {
  const rgba = renderIcon(size, { rounded, scale });
  const png = encodePng(size, rgba);
  writeFileSync(join(outDir, file), png);
  console.log(`${file} · ${size}×${size} · ${(png.length / 1024).toFixed(1)} KB`);
}
