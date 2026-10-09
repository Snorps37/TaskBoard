import { parseIcs } from './ics.js';

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
  showSchoology: false
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

// Electron exposes window.api. In a plain browser (npm run dev:web) fall back to localStorage.
export const storage = window.api ?? {
  load: async () => localStorage.getItem('taskboard'),
  save: async (json) => localStorage.setItem('taskboard', json),
  loadSettings: async () => localStorage.getItem('taskboard-settings'),
  saveSettings: async (json) => localStorage.setItem('taskboard-settings', json),
  fetchIcs: async (url) => {
    const res = await fetch(url.replace(/^webcal:/i, 'https:'));
    if (!res.ok) throw new Error(`The server answered with status ${res.status}`);
    return res.text();
  }
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(new Date());

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
  const task = { id: uid(), title: '', notes: '', due: '', color: '', done: false, tagIds: [], ...fields };
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

// Moves a task into a column, placed before `beforeId` (or at the end).
export function moveTask(id, columnId, beforeId = null) {
  const i = db.tasks.findIndex((t) => t.id === id);
  if (i < 0) return;
  const [task] = db.tasks.splice(i, 1);
  task.columnId = columnId;
  const j = beforeId ? db.tasks.findIndex((t) => t.id === beforeId) : -1;
  if (j >= 0) db.tasks.splice(j, 0, task);
  else db.tasks.push(task);
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
  if (s.rule === 'daily') return 'Every day';
  if (s.rule === 'every') return `Every ${s.every} days`;
  if (s.rule === 'weekdays') return s.days.map((d) => WEEKDAYS[d]).join(', ');
  return 'Rotation: ' + s.steps.map((x) => x || 'off').join(', ');
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
export const settings = $state({ schoologyUrl: '', includeEvents: false, lastSync: '' });
export const sync = $state({ busy: false, message: '' });

export async function loadSettings() {
  try {
    const raw = await storage.loadSettings();
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch {
    // keep defaults
  }
}
export const saveSettings = () => storage.saveSettings(JSON.stringify(settings));

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

export async function syncSchoology() {
  if (!db.loaded || !settings.schoologyUrl || sync.busy) return;
  sync.busy = true;
  try {
    const text = await storage.fetchIcs(settings.schoologyUrl);
    const { added, updated } = applySchoology(parseIcs(text));
    settings.lastSync = new Date().toISOString();
    sync.message = added || updated ? `${added} new, ${updated} updated` : 'Up to date';
    await saveSettings();
  } catch (e) {
    const msg = String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    sync.message = 'Could not sync: ' + msg;
  } finally {
    sync.busy = false;
  }
}
