// Minimal iCalendar (.ics) reader for Schoology's calendar feed.
// Returns [{ uid, title, notes, due, url, kind }] where `due` is a local YYYY-MM-DD day.

const pad = (n) => String(n).padStart(2, '0');
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// iCal text escapes: \n \, \; \\
const unescapeText = (s) =>
  s
    .replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c))
    .replace(/&amp;/g, '&');

function toLocalDay(value) {
  let m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`; // all-day event: already a calendar date
  m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  if (!m[7]) return `${m[1]}-${m[2]}-${m[3]}`; // floating local time
  // UTC timestamp: convert to the day it falls on for the person using the app.
  return localDay(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])));
}

function cleanNotes(raw) {
  let s = unescapeText(raw)
    .replace(/\s*-\s*Link:\s*\S+\s*$/, '') // Schoology appends the link; we keep it separately
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (s.length > 1500) s = s.slice(0, 1500).trimEnd() + '…';
  return s;
}

export function parseIcs(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const seen = new Set();
  const out = [];

  for (const chunk of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const body = chunk.split('END:VEVENT')[0];
    const props = {};
    for (const line of body.split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const name = line.slice(0, i).split(';')[0].toUpperCase();
      props[name] = line.slice(i + 1);
    }

    const uid = props.UID;
    const due = props.DTSTART ? toLocalDay(props.DTSTART) : null;
    if (!uid || !due || seen.has(uid)) continue;
    seen.add(uid);

    const url = (props.URL ?? '').replace(/^http:\/\//i, 'https://');
    out.push({
      uid,
      title: unescapeText(props.SUMMARY ?? '').trim() || 'Untitled',
      notes: cleanNotes(props.DESCRIPTION ?? ''),
      due,
      url,
      kind: url.includes('/assignment/') ? 'assignment' : 'event'
    });
  }
  return out;
}
