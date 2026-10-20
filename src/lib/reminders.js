import { db, ui, settings, today, fmtTime } from './db.svelte.js';

// Desktop notifications: a heads-up before each timed task, and a morning list of the day's tasks.
// Checked every 30 seconds; anything whose moment passed since the last check fires once.
// Ones missed while the computer slept are dropped instead of arriving in a pile.
const STALE = 15 * 60 * 1000;
let last = Date.now();
// Windows forgets a notification's click handler if the object is garbage collected, so keep them around.
const live = new Set();

export const canNotify = () => typeof Notification !== 'undefined';

function notify(title, body, onClick) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, icon: 'icon.png' });
  live.add(n);
  n.onclose = () => live.delete(n);
  n.onclick = () => {
    live.delete(n);
    if (window.api) window.api.showWindow();
    else window.focus();
    onClick();
  };
}

function openToday() {
  ui.view = 'calendar';
  ui.dayBoard = today();
}

function check() {
  const now = Date.now();
  const hit = (ms) => ms > last && ms <= now && now - ms < STALE;

  if (settings.remindBefore >= 0) {
    for (const t of db.tasks) {
      if (t.done || !t.due || !t.time) continue;
      if (!hit(new Date(`${t.due}T${t.time}`).getTime() - settings.remindBefore * 60000)) continue;
      const when = settings.remindBefore ? `In ${settings.remindBefore} min, at ${fmtTime(t.time)}` : `Now, ${fmtTime(t.time)}`;
      notify(t.title || 'Untitled task', when, () => db.tasks.includes(t) && (ui.editingId = t.id));
    }
  }

  if (settings.dailySummary && hit(new Date(`${today()}T${settings.dailySummary}`).getTime())) {
    const list = db.tasks.filter((t) => t.due === today() && !t.done);
    if (list.length) {
      const names = list.slice(0, 4).map((t) => t.title);
      const more = list.length > 4 ? `, and ${list.length - 4} more` : '';
      notify(`${list.length} task${list.length === 1 ? '' : 's'} today`, names.join(', ') + more, openToday);
    }
  }

  last = now;
}

export function startReminders() {
  last = Date.now();
  const id = setInterval(check, 30 * 1000);
  return () => clearInterval(id);
}
