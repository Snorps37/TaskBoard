// Reads the assignment table copied from Pearson MyLab Math.
// Each row looks like:  date line / time line / "<tab>Type Title<tab>limit<tab>attempts<tab>status" / optional "see score for ..."
// Returns [{ key, title, type, due, time, limit, scored, pastDue }] with `due` as YYYY-MM-DD.

const pad = (n) => String(n).padStart(2, '0');
const DATE = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/;
const TIME = /^\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*$/i;
const TYPE = /^(Homework|Quiz|Test|Exam|Assignment|Project|Lab)\s+/i;

// A row starts with a date line followed (after any blank lines) by a time line.
function isStart(lines, k) {
  if (!DATE.test(lines[k])) return false;
  let j = k + 1;
  while (j < lines.length && !lines[j].trim()) j++;
  return j < lines.length && TIME.test(lines[j]);
}

export function parseMylab(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out = [];
  const seen = new Map();

  for (let i = 0; i < lines.length; i++) {
    if (!isStart(lines, i)) continue;
    let end = i + 1;
    while (end < lines.length && !isStart(lines, end)) end++;
    const block = lines.slice(i, end);
    i = end - 1;

    const [, mm, dd, yy] = block[0].match(DATE);
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    const due = `${year}-${pad(mm)}-${pad(dd)}`;

    const rest = block.slice(1);
    const tm = rest.find((l) => TIME.test(l))?.match(TIME);
    const time = tm ? `${Number(tm[1])}:${tm[2]} ${tm[3].toUpperCase()}` : '';

    const titleLine = rest.find((l) => l.trim() && !TIME.test(l) && !/^\s*see score for/i.test(l));
    if (!titleLine) continue;
    const cells = titleLine.split(/\t+|\s{3,}/).map((c) => c.trim()).filter(Boolean);
    const name = cells[0];
    if (!name) continue;

    const limit = cells.slice(1).map((c) => c.match(/(\d+)\s*min/i)).find(Boolean)?.[1] ?? '';
    const scored = rest.some((l) => /see score for/i.test(l));
    const pastDue = rest.some((l) => /past due/i.test(l));

    const typeMatch = name.match(TYPE);
    const type = typeMatch ? typeMatch[1] : '';
    const title = typeMatch ? name.slice(typeMatch[0].length).trim() : name;

    // Stable id for syncing: the full name, with a counter if the same name appears twice.
    const base = name.toLowerCase().replace(/\s+/g, ' ');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);

    out.push({ key: n > 1 ? `${base}#${n}` : base, title, type, due, time, limit, scored, pastDue });
  }
  return out;
}
