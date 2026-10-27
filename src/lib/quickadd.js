import { extractOptions, COLORS } from './slash.js';
import { ymd, today, addDays, nowHM } from './db.svelte.js';

// Reads a typed task like "do laundry thursday 4pm tag:personal" into its parts.
// Returns { title, due, time, tagIds, newTags }. Only the first date and first time count;
// anything not understood stays in the title.

const WEEKDAY = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CONNECTIVES = new Set(['at', 'on', 'by', 'due', 'this']);

// Tag names can have spaces; in "tag:" they are written without them.
export const compactTag = (name) => name.replace(/\s+/g, '');

function monthOf(word) {
  const w = word.replace(/\.$/, '');
  if (w.length < 3) return -1;
  const i = MONTHS.indexOf(w.slice(0, 3));
  // "sept" and full names are fine, made-up endings ("marble") are not.
  const full = new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
  return i >= 0 && (full.startsWith(w) || w === 'sept') ? i : -1;
}

const dayNum = (word) => {
  const m = /^(\d{1,2})(st|nd|rd|th)?,?$/.exec(word);
  return m ? Number(m[1]) : 0;
};

// A real calendar date, or '' (catches things like Feb 31). Without a year, a date already past means next year.
function makeDate(y, m, d) {
  const now = new Date();
  const year = y ?? now.getFullYear();
  const date = new Date(year, m, d);
  if (date.getMonth() !== m || date.getDate() !== d) return '';
  if (y == null && ymd(date) < today()) date.setFullYear(year + 1);
  return ymd(date);
}

const hm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

function to24(h, m, ampm) {
  if (h < 1 || h > 12 || m > 59) return '';
  if (ampm === 'p' && h !== 12) h += 12;
  if (ampm === 'a' && h === 12) h = 0;
  return hm(h, m);
}

// Each matcher looks at the words starting at i and returns { due | time, used } or null.
function matchDate(w, i) {
  const a = w[i];
  if (a === 'today' || a === 'tod') return { due: today(), used: 1 };
  if (a === 'tonight') return { due: today(), time: '20:00', used: 1 };
  if (['tomorrow', 'tmrw', 'tmr', 'tomorow'].includes(a)) return { due: addDays(today(), 1), used: 1 };

  const next = a === 'next';
  const wdWord = next ? w[i + 1] : a;
  if (wdWord in WEEKDAY) {
    const from = new Date().getDay();
    let d = addDays(today(), (WEEKDAY[wdWord] - from + 7) % 7);
    if (next) d = addDays(d, 7);
    return { due: d, used: next ? 2 : 1 };
  }
  if (next && w[i + 1] === 'week') return { due: addDays(today(), 7), used: 2 };

  // "in 3 days", "in a week", "in 2 weeks"
  if (a === 'in' && w[i + 1] && w[i + 2]) {
    const n = w[i + 1] === 'a' ? 1 : Number(w[i + 1]);
    const unit = w[i + 2];
    if (Number.isInteger(n) && n > 0) {
      if (/^days?$/.test(unit)) return { due: addDays(today(), n), used: 3 };
      if (/^weeks?$/.test(unit)) return { due: addDays(today(), 7 * n), used: 3 };
    }
  }

  // "oct 25", "october 25th 2027", "25 oct"
  const mo = monthOf(a);
  if (mo >= 0 && dayNum(w[i + 1] ?? '')) {
    const hasYear = /^\d{4}$/.test(w[i + 2] ?? '');
    const due = makeDate(hasYear ? Number(w[i + 2]) : null, mo, dayNum(w[i + 1]));
    if (due) return { due, used: hasYear ? 3 : 2 };
  }
  if (dayNum(a) && monthOf(w[i + 1] ?? '') >= 0) {
    const due = makeDate(null, monthOf(w[i + 1]), dayNum(a));
    if (due) return { due, used: 2 };
  }

  // "10/25", "10/25/27", "2026-10-25"
  let m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(a);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    const due = makeDate(y, Number(m[1]) - 1, Number(m[2]));
    if (due) return { due, used: 1 };
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  if (m) {
    const due = makeDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (due) return { due, used: 1 };
  }
  return null;
}

function matchTime(w, i, afterAt) {
  const a = w[i];
  if (a === 'noon') return { time: '12:00', used: 1 };
  if (a === 'midnight') return { time: '00:00', used: 1 };

  // "4pm", "4:30pm", "4:30p"
  let m = /^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)$/.exec(a);
  if (m) {
    const time = to24(Number(m[1]), Number(m[2] ?? 0), m[3][0]);
    if (time) return { time, used: 1 };
  }
  // "4 pm", "4:30 am"
  m = /^(\d{1,2})(?::(\d{2}))?$/.exec(a);
  if (m && /^(am|pm|a\.m\.|p\.m\.)$/.test(w[i + 1] ?? '')) {
    const time = to24(Number(m[1]), Number(m[2] ?? 0), w[i + 1][0]);
    if (time) return { time, used: 2 };
  }
  // "16:00"
  m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(a);
  if (m) return { time: hm(Number(m[1]), Number(m[2])), used: 1 };
  // "at 4" -> 4 PM, "at 9" -> 9 AM (only right after "at", so plain numbers stay in the title)
  m = /^(\d{1,2})$/.exec(a);
  if (m && afterAt) {
    const h = Number(m[1]);
    if (h >= 1 && h <= 12) return { time: to24(h, 0, h < 8 || h === 12 ? 'p' : 'a'), used: 1 };
  }
  return null;
}

export function parseTask(text, tags) {
  const extracted = extractOptions(text);
  const base = parsePlainTask(extracted.text, tags);
  const errors = [...extracted.errors];
  let color = '';
  let group = '';
  for (const { key, value } of extracted.options) {
    if (key === 'tag') {
      const tag = tags.find((t) => compactTag(t.name).toLowerCase() === compactTag(value).toLowerCase());
      if (tag) { if (!base.tagIds.includes(tag.id)) base.tagIds.push(tag.id); }
      else if (!base.newTags.some((t) => t.toLowerCase() === value.toLowerCase())) base.newTags.push(value);
    } else if (key === 'color') {
      const hex = COLORS[value.toLowerCase()] || value;
      if (value.toLowerCase() === 'none') color = '';
      else if (/^#[0-9a-f]{6}$/i.test(hex)) color = hex.toLowerCase();
      else errors.push('Use a color name or #rrggbb.');
    } else if (key === 'group') group = value;
    else {
      const parsed = parsePlainTask(value, []);
      if (key === 'date' && parsed.due && !parsed.title && !parsed.time) base.due = parsed.due;
      else if (key === 'time' && parsed.time && !parsed.title) { base.time = parsed.time; if (!base.due) base.due = parsed.due; }
      else errors.push(`Invalid /${key}: ${value}`);
    }
  }
  return { ...base, color, group, errors };
}

function parsePlainTask(text, tags) {
  const raw = text.trim().split(/\s+/).filter(Boolean);
  const words = raw.map((x) => x.toLowerCase().replace(/[,.]$/, ''));
  const keep = [];
  const tagIds = [];
  const newTags = [];
  let due = '';
  let time = '';

  for (let i = 0; i < raw.length; ) {
    const tagMatch = /^tag:(.+)$/i.exec(raw[i]);
    if (tagMatch) {
      const want = tagMatch[1].toLowerCase();
      const tag = tags.find((t) => compactTag(t.name).toLowerCase() === want);
      if (tag) !tagIds.includes(tag.id) && tagIds.push(tag.id);
      else if (!newTags.some((n) => n.toLowerCase() === want)) newTags.push(tagMatch[1]);
      i++;
      continue;
    }

    // A connective ("at", "on", ...) is dropped only when a date or time follows it.
    const lead = CONNECTIVES.has(words[i]) ? 1 : 0;
    const j = i + lead;
    const d = !due && j < raw.length ? matchDate(words, j) : null;
    if (d) {
      due = d.due;
      if (d.time && !time) time = d.time;
      i = j + d.used;
      continue;
    }
    const t = !time && j < raw.length ? matchTime(words, j, words[i] === 'at') : null;
    if (t) {
      time = t.time;
      i = j + t.used;
      continue;
    }
    keep.push(raw[i]);
    i++;
  }

  // A time with no day means today, or tomorrow if that time has already passed.
  if (time && !due) due = time > nowHM() ? today() : addDays(today(), 1);

  return { title: keep.join(' '), due, time, tagIds, newTags };
}
