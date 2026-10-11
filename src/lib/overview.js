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
