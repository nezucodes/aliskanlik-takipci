// Arayüz katmanı: state'i okur, DOM'a yansıtır, olayları store'a iletir.
// Kural: kullanıcı verisi (alışkanlık adı/not) her zaman textContent ile yazılır → XSS yok.
// Aşama 3: veri kaynağı localStorage değil, kendi API'miz. Okuma senkron (snapshot),
// yazma asenkron (fetch). Bu dosyada tek satırlık fark: import + mutate() sarmalı.

import { addDays, formatTR, getActiveToday, isDebugToday, isISODate, parseISO, todayISO } from "./date.js";
import { completionRate, computeStreak, longestStreak } from "./streak.js";
import { buildSummary } from "./stats.js";
import * as store from "./apiStore.js";

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
const colorPickerEl = document.querySelector("#color-picker");
const archiveSectionEl = document.querySelector("#archive-section");
const archiveListEl = document.querySelector("#archive-list");
const archiveCountEl = document.querySelector("#archive-count");
const statTotalEl = document.querySelector("#stat-total");
const statDaysEl = document.querySelector("#stat-days");
const statBestEl = document.querySelector("#stat-best");
const statMonthEl = document.querySelector("#stat-month");
const statMonthSubEl = document.querySelector("#stat-month-sub");
const appErrorEl = document.querySelector("#app-error");
const appErrorTextEl = document.querySelector("#app-error-text");
const appErrorCloseEl = document.querySelector("#app-error-close");

const EMOJIS = ["✅", "📚", "🚶", "💻", "🏋️", "💧", "🧘", "🛏️", "🍎", "🎯"];
const PALETTE = ["#7c8bff", "#8fd3c7", "#f7b7a3", "#e6a8d7", "#f2d098", "#9ec5fe"];

let selectedEmoji = null;
let selectedColor = PALETTE[0];
let editingId = null;
let viewDate = getActiveToday();

if (isDebugToday() || (typeof location !== "undefined" && location.hostname === "localhost")) {
  if (debugPanelEl) debugPanelEl.hidden = false;
}

function showError(error) {
  if (!appErrorEl || !appErrorTextEl) return;
  appErrorTextEl.textContent = error?.message ?? String(error);
  appErrorEl.hidden = false;
}

function clearError() {
  if (appErrorEl) appErrorEl.hidden = true;
}

/**
 * Yazma işlemleri için ortak sarmal:
 * dene → başarılıysa temizle + yeniden çiz; hata varsa kullanıcıya göster.
 * Ağ hatasında arayüz eski (doğru) veriyi göstermeye devam eder.
 */
async function mutate(action) {
  try {
    await action();
    clearError();
    render();
  } catch (error) {
    console.error(error);
    showError(error);
  }
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

function updateColorSelection() {
  if (!colorPickerEl) return;
  for (const child of colorPickerEl.children) {
    child.setAttribute("aria-pressed", String(child.dataset.color === selectedColor));
  }
}

function makeColorButton(color, onPick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "color-btn";
  btn.dataset.color = color;
  btn.style.setProperty("--swatch", color);
  btn.setAttribute("aria-label", `Renk ${color}`);
  btn.setAttribute("aria-pressed", "false");
  btn.addEventListener("click", () => onPick(color));
  return btn;
}

function initColorPicker() {
  if (!colorPickerEl) return;
  colorPickerEl.replaceChildren();
  selectedColor = PALETTE[0];
  for (const color of PALETTE) {
    colorPickerEl.appendChild(
      makeColorButton(color, (picked) => {
        selectedColor = picked;
        updateColorSelection();
      }),
    );
  }
  updateColorSelection();
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

  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(base, -i);
    let done = 0;
    for (const habit of habits) {
      if (store.isDone(habit.id, date)) done += 1;
    }
    const day = document.createElement("div");
    day.className = "weekly__day";
    const total = habits.length;
    const ratio = total > 0 ? done / total : 0;
    day.style.setProperty("--fill", `${Math.round(ratio * 100)}%`);
    day.setAttribute("aria-label", `${formatTR(date)}: ${done}/${total} tamamlandı`);

    const fill = document.createElement("span");
    fill.className = "weekly__fill";
    fill.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "weekly__label";
    const d = new Date(parseISO(date));
    label.textContent = d.toLocaleDateString("tr-TR", { weekday: "short" });
    const count = document.createElement("span");
    count.className = "weekly__count";
    count.textContent = `${done}/${total}`;
    day.append(fill, label, count);
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

function renderInsights() {
  const habits = store.listHabits();
  const summary = buildSummary(habits, store.listEntries(), getActiveToday());

  if (statTotalEl) statTotalEl.textContent = String(summary.total);
  if (statDaysEl) statDaysEl.textContent = String(summary.activeDays);
  if (statBestEl) statBestEl.textContent = String(summary.bestStreak);
  if (statMonthEl) statMonthEl.textContent = `%${Math.round(summary.monthRate * 100)}`;
  if (statMonthSubEl) {
    statMonthSubEl.textContent = `${summary.monthDone}/${summary.monthPossible}`;
  }
}

function renderArchive() {
  if (!archiveSectionEl || !archiveListEl) return;
  const archived = store.listArchivedHabits();
  archiveSectionEl.hidden = archived.length === 0;
  if (archiveCountEl) archiveCountEl.textContent = `(${archived.length})`;
  archiveListEl.replaceChildren();

  for (const habit of archived) {
    const item = document.createElement("li");
    item.className = "archive-item";

    const name = document.createElement("p");
    name.className = "archive-item__name";
    name.textContent = `${habit.emoji || "✅"} ${habit.name}`;

    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "restore-btn";
    restore.textContent = "Geri getir";
    restore.addEventListener("click", () => {
      void mutate(() => store.restoreHabit(habit.id));
    });

    item.append(name, restore);
    archiveListEl.appendChild(item);
  }
}

function renderEditForm(habit) {
  const form = document.createElement("form");
  form.className = "edit-form";

  const input = document.createElement("input");
  input.type = "text";
  input.value = habit.name;
  input.maxLength = 60;
  input.required = true;
  input.setAttribute("aria-label", "Alışkanlık adı");

  let chosenColor = habit.color;

  const colors = document.createElement("div");
  colors.className = "edit-colors";
  for (const color of PALETTE) {
    const btn = makeColorButton(color, (picked) => {
      chosenColor = picked;
      for (const child of colors.children) {
        child.setAttribute("aria-pressed", String(child.dataset.color === chosenColor));
      }
    });
    btn.setAttribute("aria-pressed", String(color === chosenColor));
    colors.appendChild(btn);
  }

  const actions = document.createElement("div");
  actions.className = "edit-actions";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "mini-cancel";
  cancel.textContent = "İptal";
  cancel.addEventListener("click", () => {
    editingId = null;
    render();
  });

  const save = document.createElement("button");
  save.type = "submit";
  save.className = "mini-save";
  save.textContent = "Kaydet";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    void mutate(async () => {
      await store.updateHabit(habit.id, { name, color: chosenColor });
      editingId = null;
    });
  });

  actions.append(cancel, save);
  form.append(input, colors, actions);
  return form;
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

  renderInsights();
  renderWeekly();
  renderHeatmap();
  renderArchive();
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
    void mutate(() => store.setEntry(habit.id, viewDate, !done));
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
    void mutate(() => store.setNote(habit.id, viewDate, noteArea.value));
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

  if (editingId === habit.id) {
    body.append(renderEditForm(habit));
  } else {
    body.append(name, done ? document.createElement("div") : meta, noteBlock);
  }

  const actions = document.createElement("div");
  actions.className = "habit-actions";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "icon-btn";
  edit.textContent = "✎";
  edit.setAttribute("aria-label", `${habit.name} alışkanlığını düzenle`);
  edit.addEventListener("click", () => {
    editingId = editingId === habit.id ? null : habit.id;
    render();
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "icon-btn icon-btn--danger";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `${habit.name} alışkanlığını sil`);
  remove.addEventListener("click", () => {
    if (confirm(`"${habit.name}" silinsin mi? Geçmiş kayıtlar arşivde kalır.`)) {
      void mutate(async () => {
        await store.deleteHabit(habit.id);
        editingId = null;
      });
    }
  });

  actions.append(edit, remove);
  item.append(toggle, body, actions);
  return item;
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = inputEl.value.trim();
  if (!name) return;

  void (async () => {
    try {
      await store.createHabit({ name, emoji: selectedEmoji || "✅", color: selectedColor });
      clearError();
      inputEl.value = "";
      selectedEmoji = null;
      updateEmojiSelection();
      inputEl.focus();
      render();
    } catch (error) {
      console.error(error);
      showError(error);
    }
  })();
});

initEmojiPicker();
initColorPicker();

if (appErrorCloseEl) {
  appErrorCloseEl.addEventListener("click", clearError);
}

/**
 * Açılış: sunucudan snapshot'ı çek, gerekirse örnek veriyi ekle, sonra çiz.
 * İlk render'ı yükleme bitene kadar yapmıyoruz ki boş ekran yanıp sönmesin.
 */
async function start() {
  try {
    await store.loadState();
    await store.seedIfEmpty();
    clearError();
  } catch (error) {
    console.error(error);
    showError(error);
  }

  viewDate = getActiveToday();
  if (datePickerEl) datePickerEl.value = viewDate;
  setViewDate(viewDate);
}

void start();
