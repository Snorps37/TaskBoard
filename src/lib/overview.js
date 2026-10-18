// Works out what the Upcoming tab shows. Kept separate (and free of app state) so it's easy to test.

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function addDays(s, n) {
  const d = new Date(s + 'T00:00');
  d.setDate(d.getDate() + n);
  return fmt(d);
}

const timeKey = (t) => t.time || '99:99';
const byTime = (a, b) => timeKey(a).localeCompare(timeKey(b));
const byDueThenTime = (a, b) => a.due.localeCompare(b.due) || byTime(a, b);

// tasks: all tasks. t0: today as YYYY-MM-DD. matches: optional filter (like the tag filter).
//  - overdue: unfinished tasks from before today (a repeating task only counts if it's from the last 2 days)
//  - days: today and the next 6 days, always present (empty ones are still places to drop a task)
//  - later: dated tasks after that week (not repeating ones; those are just noise this far out)
//  - undated: unfinished tasks with no date
// Finished tasks only show on today, so nothing piles up.
export function buildOverview(tasks, t0, matches = () => true) {
  const visible = tasks.filter(matches);
  const open = visible.filter((t) => !t.done);
  const recent = addDays(t0, -2);

  const overdue = open
    .filter((t) => t.due && t.due < t0 && (!t.seriesId || t.due >= recent))
    .sort(byDueThenTime);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(t0, i);
    return { i, date, items: visible.filter((t) => t.due === date && (i === 0 || !t.done)).sort(byTime) };
  });

  const horizon = addDays(t0, 6);
  const later = open.filter((t) => t.due && t.due > horizon && !t.seriesId).sort(byDueThenTime);
  const undated = open.filter((t) => !t.due);

  return { overdue, days, later, undated };
}

// The drop targets in the tray that appears while you drag a task:
// "No date", today and the next 6 days, and "+1 week" (counted from the task's own date, or today if it has none/is past).
export function trayTiles(t0, taskDue = '') {
  const base = taskDue && taskDue >= t0 ? taskDue : t0;
  return [
    { key: 'none', kind: 'none', date: '', i: -1 },
    ...Array.from({ length: 7 }, (_, i) => ({ key: `d${i}`, kind: 'day', date: addDays(t0, i), i })),
    { key: 'week', kind: 'week', date: addDays(base, 7), i: -1 }
  ];
}

// Bundles tasks that share a group name (and day) into one entry, placed where the group's first task is.
// Returns, in order: { key, task } for a task on its own, or { key, group, items } for 2+ tasks in a group.
// A group with only one task that day just shows as that task.
export function groupTasks(tasks) {
  const entries = [];
  const groups = new Map();
  for (const t of tasks) {
    const name = (t.group ?? '').trim();
    if (!name) {
      entries.push({ key: t.id, task: t });
      continue;
    }
    const key = `g:${t.due ?? ''}:${name.toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, group: name, items: [] };
      groups.set(key, g);
      entries.push(g);
    }
    g.items.push(t);
  }
  return entries.map((e) => (e.items?.length === 1 ? { key: e.items[0].id, task: e.items[0] } : e));
}
