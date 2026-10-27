export const COLORS = { blue: '#38bdf8', green: '#4ade80', pink: '#f472b6', yellow: '#fbbf24', red: '#fb7185', purple: '#a78bfa', teal: '#2dd4bf', indigo: '#8b9cff' };
export const COMMANDS = [
  { name: 'tag', hint: 'Apply a tag; repeat for multiple tags' },
  { name: 'color', hint: 'Named color, saved hex color, or none' },
  { name: 'group', hint: 'Bundle related tasks' },
  { name: 'date', hint: 'Due date, e.g. tomorrow or "in 3 days"' },
  { name: 'time', hint: 'Time, e.g. 4pm or 16:30' }
];
export const quote = (value) => /\s/.test(value) ? JSON.stringify(value) : value;

// Read quoted values without interpreting dates, colors or unknown commands as titles.
export function extractOptions(text) {
  const options = [];
  const errors = [];
  const rest = text.replace(/(?:^|\s)\/(tag|color|group|date|time)\b(?:\s+("(?:\\.|[^"\\])*"|[^\s/][^\s]*))?/gi, (all, key, raw) => {
    if (!raw) { errors.push(`/${key} needs a value`); return ' '; }
    let value = raw;
    if (raw.startsWith('"')) {
      try { value = JSON.parse(raw); } catch { errors.push(`Finish the quoted /${key} value`); }
    }
    if (raw.startsWith('"') && !raw.endsWith('"')) errors.push(`Finish the quoted /${key} value`);
    if (!value.trim()) errors.push(`/${key} needs a value`);
    options.push({ key: key.toLowerCase(), value });
    return ' ';
  });
  if (/(?:^|\s)\/[a-z]+/i.test(rest)) errors.push('Unknown slash option. Choose /tag, /color, /group, /date or /time.');
  return { text: rest.trim(), options, errors };
}
