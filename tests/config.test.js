// Yayın yapılandırmasının saf parçaları.
// Not: config.js `location` okur; Node'da location yok → yayın dalı seçilir.
// Bu yüzden testler fonksiyonu parametreyle besliyor (ikisini de sınayalım).
import test from "node:test";
import assert from "node:assert/strict";
import { connectionErrorMessage } from "../js/config.js";

test("yerelde terminal ipucu verir", () => {
  const message = connectionErrorMessage({ local: true });
  assert.match(message, /npm run server/);
});

test("yayında terminalden bahsetmez (kullanıcının terminali yok)", () => {
  const message = connectionErrorMessage({ local: false });
  assert.doesNotMatch(message, /npm run server/);
  assert.match(message, /tekrar dene/i);
});

test("soğuk başlangıç ihtimalini açıkça söyler", () => {
  assert.match(connectionErrorMessage({ local: false }), /uyanıyor olabilir/);
});
