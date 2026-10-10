import { parseIcs } from './ics.js';
import { parseMylab } from './mylab.js';

// All app state lives here. Components import `db` and `ui` and mutate them directly;
// App.svelte watches `db` and saves it to disk whenever it changes.

const PALETTE = ['#8b9cff', '#4ade80', '#f472b6', '#fbbf24', '#38bdf8', '#fb7185', '#a78bfa', '#2dd4bf'];

export const ui = $state({
  view: 'board',
  filterTagId: null,
  editingId: null,
  showTags: false,
  selectedDay: null,
  dayBoard: null,
  showSeries: false,
  showSchoology: false,
  showMylab: false,
  showPrefs: false,
  dragTagId: null
});

export const db = $state({
  loaded: false,
  boards: [],
  tasks: [],
  tags: [],
  series: [],
  dismissed: [],
  savedColors: [],
  currentBoardId: null
});

// Electron exposes window.api. In a plain browser (the web version) fall back to localStorage.
export const isDesktop = !!window.api;
export const storage = window.api ?? {
  load: async () => localStorage.getItem('taskboard'),
  save: async (json) => localStorage.setItem('taskboard', json),
  loadSettings: async () => localStorage.getItem('taskboard-settings'),
  saveSettings: async (json) => localStorage.setItem('taskboard-settings', json),
  readClipboard: async () => navigator.clipboard.readText(),
  // In a browser: try the link directly; if the browser blocks it (CORS), go through your proxy if you set one.
  fetchIcs: async (url) => {
    const target = url.trim().replace(/^webcal:/i, 'https:');
    const get = async (u) => {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`The server answered with status ${res.status}`);
      const text = await res.text();
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That link did not return a calendar feed');
      return text;
    };
    try {
      return await get(target);
    } catch (e) {
      if (!(e instanceof TypeError)) throw e; // a blocked or failed request, not an HTTP error
      const proxy = (settings.proxyUrl || '').trim();
      if (!proxy) {
        throw new Error(
          "The browser blocked the request (Schoology doesn't let websites read the feed directly). Import the downloaded calendar file instead, or set a proxy address."
        );
      }
      return get(`${proxy}${proxy.includes('?') ? '&' : '?'}url=${encodeURIComponent(target)}`);
    }
  }
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(new Date());
export const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// "15:30" -> "3:30 PM" (in the computer's own style)
export const fmtTime = (hm) =>
  hm ? new Date(`1970-01-01T${hm}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
// Sorts timed tasks by time, with untimed ones after (stable, so manual order is kept for ties).
export const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99');
export const modalOpen = () =>
  !!(ui.editingId || ui.showTags || ui.showSeries || ui.showSchoology || ui.showMylab || ui.showPrefs);

function seed() {
  return {
    boards: [
      {
        id: 'main',
        name: 'Main',
        columns: [
          { id: 'todo', name: 'To do' },
          { id: 'doing', name: 'In progress' },
          { id: 'done', name: 'Done' }
        ]
      }
    ],
    currentBoardId: 'main',
    series: [],
    dismissed: [],
    tags: [
      { id: 'academics', name: 'Academics', color: '#38bdf8' },
      { id: 'games', name: 'Games', color: '#a78bfa' },
      { id: 'personal', name: 'Personal', color: '#4ade80' }
    ],
    savedColors: ['#8b9cff', '#f472b6', '#fbbf24', '#fb7185'],
    tasks: [
      { id: uid(), columnId: 'todo', title: 'Click a card to edit it', notes: 'Give it a due date and it shows up on the calendar.', due: today(), color: '', done: false, tagIds: ['personal'] },
      { id: uid(), columnId: 'todo', title: 'Drag me to another column', notes: '', due: '', color: '#f472b6', done: false, tagIds: ['games'] }
    ]
  };
}

export async function init() {
  let data = null;
  try {
    const raw = await storage.load();
    if (raw) data = JSON.parse(raw);
  } catch {
    data = null;
  }
  Object.assign(db, { ...seed(), ...(data ?? {}) }, { loaded: true });
  extendSeries(addDays(today(), 60));
}

// ---- boards & columns ----
export const currentBoard = () => db.boards.find((b) => b.id === db.currentBoardId) ?? db.boards[0];

export function addBoard(name) {
  const id = uid();
  db.boards.push({
    id,
    name,
    columns: [
      { id: uid(), name: 'To do' },
      { id: uid(), name: 'In progress' },
      { id: uid(), name: 'Done' }
    ]
  });
  db.currentBoardId = id;
}

export function addColumn(name) {
  currentBoard()?.columns.push({ id: uid(), name });
}

export function removeColumn(id) {
  const board = currentBoard();
  if (!board) return;
  const i = board.columns.findIndex((c) => c.id === id);
  if (i < 0) return;
  board.columns.splice(i, 1);
  for (let k = db.tasks.length - 1; k >= 0; k--) {
    if (db.tasks[k].columnId === id) {
      if (db.tasks[k].externalId) db.dismissed.push(db.tasks[k].externalId);
      db.tasks.splice(k, 1);
    }
  }
}

// ---- tasks ----
export function addTask(fields) {
  const task = { id: uid(), title: '', notes: '', due: '', time: '', color: '', done: false, tagIds: [], ...fields };
  db.tasks.push(task);
  return task;
}

export function removeTask(id) {
  const i = db.tasks.findIndex((t) => t.id === id);
  if (i < 0) return;
  // Remember imported tasks you delete so a sync doesn't bring them back.
  if (db.tasks[i].externalId) db.dismissed.push(db.tasks[i].externalId);
  db.tasks.splice(i, 1);
}

// A column named Done (or Complete / Finished) is where checked tasks go.
const isDoneColumn = (c) => /^(done|complete|completed|finished)$/i.test(c.name.trim());
const doneColumnOf = (columnId) =>
  db.boards.find((b) => b.columns.some((c) => c.id === columnId))?.columns.find(isDoneColumn) ?? null;

// Moves a task into a column, placed before `beforeId` (or at the end).
// Moving into the Done column checks it off; moving out of Done unchecks it.
export function moveTask(id, columnId, beforeId = null) {
  const i = db.tasks.findIndex((t) => t.id === id);
  if (i < 0) return;
  const [task] = db.tasks.splice(i, 1);
  const from = task.columnId;
  task.columnId = columnId;
  const j = beforeId ? db.tasks.findIndex((t) => t.id === beforeId) : -1;
  if (j >= 0) db.tasks.splice(j, 0, task);
  else db.tasks.push(task);

  const doneCol = doneColumnOf(columnId);
  if (doneCol && columnId === doneCol.id && from !== columnId) {
    task.prevColumnId = from;
    task.done = true;
  } else if (doneCol && from === doneCol.id && columnId !== doneCol.id) {
    task.done = false;
  }
}

// Checks or unchecks a task. Checking moves it to the Done column; unchecking puts it back where it came from.
export function setTaskDone(task, value) {
  const doneCol = doneColumnOf(task.columnId);
  if (!doneCol) {
    task.done = value;
    return;
  }
  if (value) {
    if (task.columnId !== doneCol.id) moveTask(task.id, doneCol.id);
    else task.done = true;
  } else {
    task.done = false;
    if (task.columnId === doneCol.id) {
      const board = db.boards.find((b) => b.columns.some((c) => c.id === doneCol.id));
      const back =
        board.columns.find((c) => c.id === task.prevColumnId && c.id !== doneCol.id) ??
        board.columns.find((c) => c.id !== doneCol.id);
      if (back) moveTask(task.id, back.id);
    }
  }
}

export const matchesFilter = (t) => !ui.filterTagId || t.tagIds.includes(ui.filterTagId);

// The color a task is drawn with: its own color, else its first tag's color.
export function accentOf(t) {
  if (t.color) return t.color;
  const tag = t.tagIds.length ? db.tags.find((x) => x.id === t.tagIds[0]) : null;
  return tag?.color ?? '';
}

// ---- tags ----
export const tagById = (id) => db.tags.find((t) => t.id === id);

export function addTag(name) {
  const tag = { id: uid(), name, color: PALETTE[db.tags.length % PALETTE.length] };
  db.tags.push(tag);
  return tag;
}

export function removeTag(id) {
  const i = db.tags.findIndex((t) => t.id === id);
  if (i >= 0) db.tags.splice(i, 1);
  for (const t of db.tasks) {
    const k = t.tagIds.indexOf(id);
    if (k >= 0) t.tagIds.splice(k, 1);
  }
  if (ui.filterTagId === id) ui.filterTagId = null;
}

// Adds a tag to a task (used when you drag a tag onto it).
export function tagTask(task, tagId) {
  if (!task.tagIds.includes(tagId)) task.tagIds.push(tagId);
}

export function toggleTag(task, tagId) {
  const k = task.tagIds.indexOf(tagId);
  if (k >= 0) task.tagIds.splice(k, 1);
  else task.tagIds.push(tagId);
}

// ---- saved colors ----
export function addColor(hex) {
  const h = hex.toLowerCase();
  if (!db.savedColors.includes(h)) db.savedColors.push(h);
}

export function removeColor(hex) {
  const i = db.savedColors.indexOf(hex);
  if (i >= 0) db.savedColors.splice(i, 1);
}

// ---- recurring tasks ----
// A "series" creates real tasks ahead of time (about 60 days out). Each task remembers its seriesId.
// rule: 'daily' | 'every' (every N days) | 'weekdays' (days: 0=Sun..6=Sat) | 'cycle' (steps, one per day, repeating)
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const parseDay = (s) => new Date(s + 'T00:00');
export const addDays = (s, n) => {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const weekdayOf = (s) => parseDay(s).getDay();

function nextWeekday(s, from) {
  let d = from;
  for (let k = 0; k < 7 && !s.days.includes(weekdayOf(d)); k++) d = addDays(d, 1);
  return d;
}

function advance(s) {
  if (s.rule === 'every') return addDays(s.nextDate, Math.max(1, s.every));
  if (s.rule === 'weekdays') return nextWeekday(s, addDays(s.nextDate, 1));
  return addDays(s.nextDate, 1);
}

function titleFor(s, i) {
  if (s.rule !== 'cycle') return s.title;
  const step = s.steps[i % s.steps.length];
  if (!step) return '';
  return s.title ? `${s.title}: ${step}` : step;
}

export function describeSeries(s) {
  const at = s.time ? ` at ${fmtTime(s.time)}` : '';
  if (s.rule === 'daily') return 'Every day' + at;
  if (s.rule === 'every') return `Every ${s.every} days` + at;
  if (s.rule === 'weekdays') return s.days.map((d) => WEEKDAYS[d]).join(', ') + at;
  return 'Rotation: ' + s.steps.map((x) => x || 'off').join(', ') + at;
}

// Recurring tasks only show on the board once they're due (or overdue and not done).
export const showsOnBoard = (t) => !t.seriesId || t.due === today() || (t.due < today() && !t.done);

export function extendSeries(untilDate) {
  const now = today();
  for (const s of db.series) {
    let guard = 0;
    while (s.nextDate <= untilDate && (!s.until || s.nextDate <= s.until) && guard++ < 400) {
      const title = titleFor(s, s.nextIndex);
      if (title && s.nextDate >= now) {
        addTask({
          title,
          notes: s.notes,
          due: s.nextDate,
          time: s.time ?? '',
          color: s.color,
          tagIds: [...s.tagIds],
          columnId: s.columnId,
          seriesId: s.id
        });
      }
      s.nextIndex += 1;
      s.nextDate = advance(s);
    }
  }
}

export function addSeries(fields) {
  const s = {
    id: uid(),
    title: '',
    notes: '',
    color: '',
    tagIds: [],
    columnId: currentBoard()?.columns[0]?.id,
    rule: 'daily',
    every: 2,
    days: [],
    steps: [],
    start: today(),
    until: '',
    time: '',
    nextIndex: 0,
    ...fields
  };
  s.nextDate = s.rule === 'weekdays' ? nextWeekday(s, s.start) : s.start;
  db.series.push(s);
  extendSeries(addDays(today(), 60));
  return s;
}

// Move every unfinished task of a series from `fromDate` onward by `days` (negative pulls earlier).
export function pushSeries(id, fromDate, days) {
  const s = db.series.find((x) => x.id === id);
  const n = Math.trunc(Number(days));
  if (!s || !n) return;
  for (const t of db.tasks) {
    if (t.seriesId === id && !t.done && t.due >= fromDate) t.due = addDays(t.due, n);
  }
  s.nextDate = addDays(s.nextDate, n);
  extendSeries(addDays(today(), 60));
}

// Removes the series and its upcoming unfinished tasks. Finished and past tasks stay.
export function removeSeries(id) {
  const now = today();
  for (let k = db.tasks.length - 1; k >= 0; k--) {
    const t = db.tasks[k];
    if (t.seriesId === id && !t.done && t.due >= now) db.tasks.splice(k, 1);
  }
  const i = db.series.findIndex((s) => s.id === id);
  if (i >= 0) db.series.splice(i, 1);
}

// ---- settings (kept in a separate file from the task data) ----
export const settings = $state({
  loaded: false,
  schoologyUrl: '',
  includeEvents: false,
  lastSync: '',
  proxyUrl: '', // web version only: address of your own proxy for the Schoology feed
  mylabClass: 'AP Calc',
  theme: 'midnight',
  customThemes: [], // your saved themes: [{ id, name, bg, surface, text, accent }]
  startup: 'today' // 'today' (today's board) | 'board' | 'calendar'
});
export const sync = $state({ busy: false, message: '' });

export async function loadSettings() {
  try {
    const raw = await storage.loadSettings();
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch {
    // keep defaults
  }
  // Version 0.3 kept a single custom theme; turn it into a saved theme.
  if (settings.customTheme) {
    const c = settings.customTheme;
    const edited = c.bg !== '#0d0f14' || c.surface !== '#14171e' || c.text !== '#e8eaf0' || c.accent !== '#8b9cff';
    if (edited && !settings.customThemes.length) {
      const id = uid();
      settings.customThemes.push({ id, name: 'Custom', bg: c.bg, surface: c.surface, text: c.text, accent: c.accent });
      if (settings.theme === 'custom') settings.theme = id;
    }
    delete settings.customTheme;
  }
  if (settings.theme === 'custom') settings.theme = 'midnight';
  settings.loaded = true;
}
export function saveSettings() {
  const { loaded, ...toSave } = settings;
  return storage.saveSettings(JSON.stringify(toSave));
}

// ---- Schoology import (read-only, from the calendar feed) ----
function findOrCreateTag(name) {
  return db.tags.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? addTag(name);
}

// Adds new assignments and applies teacher changes. Anything you changed yourself is left alone.
function applySchoology(events) {
  const column = currentBoard()?.columns[0];
  if (!column) return { added: 0, updated: 0 };
  const cutoff = addDays(today(), -14); // don't pull in long-finished work on the first sync
  let academics = null;
  let added = 0;
  let updated = 0;

  for (const ev of events) {
    if (ev.kind === 'event' && !settings.includeEvents) continue;
    if (db.dismissed.includes(ev.uid)) continue;

    const existing = db.tasks.find((t) => t.externalId === ev.uid);
    if (existing) {
      let changed = false;
      if (existing.title === existing.sync?.title && existing.title !== ev.title) {
        existing.title = ev.title;
        changed = true;
      }
      if (existing.due === existing.sync?.due && existing.due !== ev.due) {
        existing.due = ev.due;
        changed = true;
      }
      if (existing.sync?.title !== ev.title || existing.sync?.due !== ev.due) {
        existing.sync = { title: ev.title, due: ev.due };
      }
      if (changed) updated++;
      continue;
    }

    if (ev.due < cutoff) continue;
    if (ev.kind === 'assignment') academics ??= findOrCreateTag('Academics');
    addTask({
      title: ev.title,
      notes: ev.notes,
      due: ev.due,
      columnId: column.id,
      tagIds: ev.kind === 'assignment' ? [academics.id] : [],
      externalId: ev.uid,
      url: ev.url,
      sync: { title: ev.title, due: ev.due }
    });
    added++;
  }
  return { added, updated };
}

function finishSchoology(text) {
  const { added, updated } = applySchoology(parseIcs(text));
  settings.lastSync = new Date().toISOString();
  sync.message = added || updated ? `${added} new, ${updated} updated` : 'Up to date';
}

// Import a calendar (.ics) file you downloaded from Schoology. Run it again later to pick up changes.
export async function importSchoologyFile(text) {
  if (!text.includes('BEGIN:VCALENDAR')) {
    sync.message = "Could not import: that file isn't a calendar (.ics) file.";
    return;
  }
  finishSchoology(text);
  await saveSettings();
}

export async function syncSchoology() {
  if (!db.loaded || !settings.schoologyUrl || sync.busy) return;
  sync.busy = true;
  try {
    finishSchoology(await storage.fetchIcs(settings.schoologyUrl));
    await saveSettings();
  } catch (e) {
    const msg = String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    sync.message = 'Could not sync: ' + msg;
  } finally {
    sync.busy = false;
  }
}

// ---- Pearson MyLab Math import (paste the assignment table; run again to sync) ----
export const mylab = $state({ message: '' });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function mylabNotes(r) {
  return [r.type, r.time ? `Due ${r.time}` : '', r.limit ? `Time limit ${r.limit} min` : ''].filter(Boolean).join('. ');
}

// Adds new assignments, follows date changes, and ticks off ones that now have a score.
// Skips assignments that already have a score, or were due more than two weeks ago.
function applyMylab(records, className) {
  const column = currentBoard()?.columns[0];
  if (!column) return { added: 0, updated: 0, done: 0 };
  const cutoff = addDays(today(), -14);
  let tag = null;
  let added = 0;
  let updated = 0;
  let done = 0;

  for (const r of records) {
    const id = `mylab:${slug(className)}:${r.key}`;
    if (db.dismissed.includes(id)) continue;

    const existing = db.tasks.find((t) => t.externalId === id);
    if (existing) {
      if (existing.due === existing.sync?.due && existing.due !== r.due) {
        existing.due = r.due;
        updated++;
      }
      if (r.scored && !existing.sync?.scored && !existing.done) {
        setTaskDone(existing, true);
        done++;
      }
      existing.sync = { due: r.due, scored: r.scored };
      continue;
    }

    if (r.scored || r.due < cutoff) continue;
    tag ??= findOrCreateTag(className);
    addTask({
      title: `${className}: ${r.title}`,
      notes: mylabNotes(r),
      due: r.due,
      columnId: column.id,
      tagIds: [tag.id],
      externalId: id,
      sync: { due: r.due, scored: r.scored }
    });
    added++;
  }
  return { added, updated, done };
}

export function syncMylabText(text) {
  const className = (settings.mylabClass || '').trim() || 'AP Calc';
  const records = parseMylab(text ?? '');
  if (!records.length) {
    mylab.message = "Couldn't find any assignments in that text. Copy the assignment table from MyLab and try again.";
    return;
  }
  const { added, updated, done } = applyMylab(records, className);
  mylab.message =
    added || updated || done
      ? `${added} new, ${updated} date change${updated === 1 ? '' : 's'}, ${done} marked done`
      : 'Up to date';
}

export async function syncMylabClipboard() {
  try {
    syncMylabText(await storage.readClipboard());
  } catch (e) {
    mylab.message = "Couldn't read the clipboard. Paste the text into the box instead.";
  }
}
