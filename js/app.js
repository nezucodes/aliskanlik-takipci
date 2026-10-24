// Arayüz katmanı: state'i okur, DOM'a yansıtır, olayları store'a iletir.
// Kural: kullanıcı verisi (alışkanlık adı/not) her zaman textContent ile yazılır → XSS yok.

import { addDays, formatTR, getActiveToday, isDebugToday, isISODate, parseISO, todayISO } from "./date.js";
import { completionRate, computeStreak, longestStreak } from "./streak.js";
import * as store from "./store.js";

const pendingListEl = document.querySelector("#pending-list");
const doneListEl = document.querySelector("#done-list");
const pendingEmptyEl = document.querySelector("#pending-empty");
const doneEmptyEl = document.querySelector("#done-empty");
const formEl = document.querySelector("#add-form");
const inputEl = document.querySelector("#habit-name");
const todayLabelEl = document.querySelector("#today-label");
const summaryEl = document.querySelector("#summary");
const pageTitleEl = document.querySelector("#page-title");
const datePickerEl = document.querySelector("#date-picker");
const backTodayEl = document.querySelector("#back-today");
const viewHintEl = document.querySelector("#view-hint");
const emojiPickerEl = document.querySelector("#emoji-picker");
const debugPanelEl = document.querySelector("#debug-panel");
const debugDateEl = document.querySelector("#debug-date");
const debugApplyEl = document.querySelector("#debug-apply");
const debugClearEl = document.querySelector("#debug-clear");
const menuToggleEl = document.querySelector("#menu-toggle");
const menuPanelEl = document.querySelector("#menu-panel");
const weeklyStripEl = document.querySelector("#weekly-strip");
const heatmapEl = document.querySelector("#heatmap");

const EMOJIS = ["✅", "📚", "🚶", "💻", "🏋️", "💧", "🧘", "🛏️", "🍎", "🎯"];
let selectedEmoji = null;

let viewDate = getActiveToday();

if (isDebugToday() || (typeof location !== "undefined" && location.hostname === "localhost")) {
  if (debugPanelEl) debugPanelEl.hidden = false;
}

function updateEmojiSelection() {
  if (!emojiPickerEl) return;
  for (const child of emojiPickerEl.children) {
    child.setAttribute("aria-pressed", String(child.dataset.emoji === selectedEmoji));
  }
}

function initEmojiPicker() {
  if (!emojiPickerEl) return;
  emojiPickerEl.replaceChildren();
  selectedEmoji = null;
  for (const emoji of EMOJIS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-btn";
    btn.textContent = emoji;
    btn.dataset.emoji = emoji;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      selectedEmoji = emoji;
      updateEmojiSelection();
      inputEl?.focus();
    });
    emojiPickerEl.appendChild(btn);
  }
}

if (menuToggleEl && menuPanelEl) {
  menuToggleEl.addEventListener("click", () => {
    const isHidden = menuPanelEl.hidden;
    menuPanelEl.hidden = !isHidden;
    menuToggleEl.setAttribute("aria-expanded", String(isHidden));
  });
  document.addEventListener("click", (event) => {
    if (!menuPanelEl.contains(event.target) && !menuToggleEl.contains(event.target)) {
      menuPanelEl.hidden = true;
      menuToggleEl.setAttribute("aria-expanded", "false");
    }
  });
}

function setViewDate(date) {
  if (!isISODate(date)) return;
  viewDate = date;
  if (datePickerEl) datePickerEl.value = viewDate;
  const isToday = viewDate === getActiveToday();
  if (backTodayEl) backTodayEl.hidden = isToday;
  if (pageTitleEl) {
    pageTitleEl.textContent = isToday ? "Bugün ne yaptın?" : "Geçmişe bak";
  }
  if (viewHintEl) {
    viewHintEl.textContent = isToday ? "" : `${formatTR(viewDate)} tarihine bakıyorsun.`;
  }
  render();
}

if (datePickerEl) {
  datePickerEl.value = viewDate;
  datePickerEl.addEventListener("change", () => {
    if (isISODate(datePickerEl.value)) {
      setViewDate(datePickerEl.value);
      if (menuPanelEl) menuPanelEl.hidden = true;
      if (menuToggleEl) menuToggleEl.setAttribute("aria-expanded", "false");
    }
  });
}

if (backTodayEl) {
  backTodayEl.addEventListener("click", () => {
    setViewDate(getActiveToday());
    if (menuPanelEl) menuPanelEl.hidden = true;
    if (menuToggleEl) menuToggleEl.setAttribute("aria-expanded", "false");
  });
}

if (debugApplyEl && debugDateEl) {
  debugApplyEl.addEventListener("click", () => {
    if (!isISODate(debugDateEl.value)) return;
    if (window.__htDebug) {
      window.__htDebug.set(debugDateEl.value);
    } else {
      const url = new URL(location.href);
      url.searchParams.set("debug", debugDateEl.value);
      location.href = url.toString();
      return;
    }
    viewDate = debugDateEl.value;
    if (datePickerEl) datePickerEl.value = viewDate;
    setViewDate(viewDate);
  });
}

if (debugClearEl) {
  debugClearEl.addEventListener("click", () => {
    if (window.__htDebug) {
      window.__htDebug.clear();
    } else {
      const url = new URL(location.href);
      url.searchParams.delete("debug");
      location.href = url.toString();
      return;
    }
    viewDate = todayISO();
    if (datePickerEl) datePickerEl.value = viewDate;
    setViewDate(viewDate);
  });
}

function renderWeekly() {
  if (!weeklyStripEl) return;
  weeklyStripEl.replaceChildren();
  const base = getActiveToday();
  const habits = store.listHabits();
  const totalHabits = habits.length || 1;

  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(base, -i);
    let done = 0;
    for (const habit of habits) {
      if (store.isDone(habit.id, date)) done += 1;
    }
    const day = document.createElement("div");
    day.className = "weekly__day";
    const label = document.createElement("span");
    label.className = "weekly__label";
    const d = new Date(parseISO(date));
    label.textContent = d.toLocaleDateString("tr-TR", { weekday: "short" });
    const count = document.createElement("span");
    count.className = "weekly__count";
    count.textContent = `${done}/${habits.length}`;
    day.append(label, count);
    weeklyStripEl.appendChild(day);
  }
}

function renderHeatmap() {
  if (!heatmapEl) return;
  heatmapEl.replaceChildren();
  const base = getActiveToday();
  const habits = store.listHabits();
  const days = 91;
  const cells = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(base, -i);
    let done = 0;
    for (const habit of habits) {
      if (store.isDone(habit.id, date)) done += 1;
    }
    let level = 0;
    if (habits.length === 0) level = 0;
    else {
      const ratio = done / habits.length;
      if (ratio === 0) level = 0;
      else if (ratio < 0.25) level = 1;
      else if (ratio < 0.5) level = 2;
      else if (ratio < 0.75) level = 3;
      else level = 4;
    }
    const cell = document.createElement("div");
    cell.className = "heatmap__cell";
    cell.dataset.level = String(level);
    cell.dataset.tooltip = `${formatTR(date)} · ${done}/${habits.length} tamamlandı`;
    cells.push(cell);
  }
  for (const cell of cells) {
    heatmapEl.appendChild(cell);
  }
}

function render() {
  todayLabelEl.textContent = formatTR(getActiveToday());
  if (debugDateEl && !debugDateEl.value && isDebugToday()) {
    debugDateEl.value = getActiveToday();
  }

  const habits = store.listHabits();
  pendingListEl.replaceChildren();
  doneListEl.replaceChildren();

  const isToday = viewDate === getActiveToday();
  let doneCount = 0;
  let pendingCount = 0;

  for (const habit of habits) {
    const dates = store.doneDatesFor(habit.id);
    const done = store.isDone(habit.id, viewDate);
    if (done) {
      doneCount += 1;
      doneListEl.append(renderHabit(habit, dates, done));
    } else {
      pendingCount += 1;
      pendingListEl.append(renderHabit(habit, dates, done));
    }
  }

  pendingEmptyEl.hidden = pendingCount > 0;
  doneEmptyEl.hidden = doneCount > 0;

  summaryEl.textContent = habits.length
    ? `${doneCount}/${habits.length} ${isToday ? "bugün tamamlandı" : "bu tarihte tamamlandı"}`
    : "";

  renderWeekly();
  renderHeatmap();
}

function renderHabit(habit, dates, done) {
  const item = document.createElement("li");
  item.className = "habit";
  if (done) item.classList.add("is-done");
  item.style.setProperty("--habit-color", habit.color);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "toggle";
  toggle.textContent = done ? "✓" : "";
  toggle.setAttribute("aria-pressed", String(done));
  toggle.setAttribute(
    "aria-label",
    `${habit.name}: ${done ? "tamamlandı, geri al" : "tamamlandı olarak işaretle"}`,
  );
  toggle.addEventListener("click", () => {
    store.setEntry(habit.id, viewDate, !done);
    render();
  });

  const body = document.createElement("div");
  body.className = "habit-body";

  const name = document.createElement("p");
  name.className = "habit-name";
  name.textContent = `${habit.emoji || "✅"} ${habit.name}`;

  const meta = document.createElement("p");
  meta.className = "habit-meta";
  const streak = computeStreak(dates, getActiveToday());
  const best = longestStreak(dates);
  const rate = Math.round(completionRate(dates, addDays(getActiveToday(), -29), getActiveToday()) * 100);
  meta.textContent = `🔥 ${streak} gün · en iyi ${best} · son 30 gün %${rate}`;

  const entry = store.getEntry(habit.id, viewDate);
  const noteBlock = document.createElement("div");
  noteBlock.className = "note-block";

  const noteToggle = document.createElement("button");
  noteToggle.type = "button";
  noteToggle.className = "note-toggle";
  noteToggle.textContent = entry?.note && entry.note.trim() ? "Notu düzenle" : "Not ekle";

  const notePanel = document.createElement("div");
  notePanel.className = "note-panel";
  notePanel.hidden = true;

  const noteArea = document.createElement("textarea");
  noteArea.className = "note-area";
  noteArea.placeholder = "Kısa not yaz...";
  noteArea.maxLength = 280;
  noteArea.value = entry?.note || "";

  const noteActions = document.createElement("div");
  noteActions.className = "note-actions";

  const noteCancel = document.createElement("button");
  noteCancel.type = "button";
  noteCancel.className = "note-cancel";
  noteCancel.textContent = "İptal";

  const noteSave = document.createElement("button");
  noteSave.type = "button";
  noteSave.className = "note-save";
  noteSave.textContent = "Kaydet";

  noteCancel.addEventListener("click", () => {
    noteArea.value = entry?.note || "";
    notePanel.hidden = true;
    noteToggle.textContent = noteArea.value.trim() ? "Notu düzenle" : "Not ekle";
  });

  noteSave.addEventListener("click", () => {
    store.setNote(habit.id, viewDate, noteArea.value);
    const updated = store.getEntry(habit.id, viewDate);
    notePreview.textContent = updated?.note || "";
    notePreview.hidden = !(updated?.note && updated.note.trim().length > 0);
    noteToggle.textContent = updated?.note && updated.note.trim() ? "Notu düzenle" : "Not ekle";
    notePanel.hidden = true;
  });

  noteToggle.addEventListener("click", () => {
    notePanel.hidden = !notePanel.hidden;
    if (!notePanel.hidden) {
      const current = store.getEntry(habit.id, viewDate);
      noteArea.value = current?.note || "";
      noteArea.focus();
    }
  });

  noteActions.append(noteCancel, noteSave);
  notePanel.append(noteArea, noteActions);

  const notePreview = document.createElement("p");
  notePreview.className = "note-preview";
  notePreview.textContent = entry?.note || "";
  notePreview.hidden = !(entry?.note && entry.note.trim().length > 0);

  noteBlock.append(noteToggle, notePanel, notePreview);
  body.append(name, done ? meta : document.createElement("div"), noteBlock);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `${habit.name} alışkanlığını sil`);
  remove.addEventListener("click", () => {
    if (confirm(`"${habit.name}" silinsin mi? Geçmiş kayıtlar arşivde kalır.`)) {
      store.deleteHabit(habit.id);
      render();
    }
  });

  item.append(toggle, body, remove);
  return item;
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = inputEl.value.trim();
  if (!name) return;

  store.createHabit({ name, emoji: selectedEmoji || "✅" });
  inputEl.value = "";
  selectedEmoji = null;
  updateEmojiSelection();
  inputEl.focus();
  render();
});

initEmojiPicker();
store.seedIfEmpty();
viewDate = getActiveToday();
if (datePickerEl) datePickerEl.value = viewDate;
setViewDate(viewDate);
