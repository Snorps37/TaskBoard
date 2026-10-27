const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
async function parser() {
  const slash = moduleUrl(fs.readFileSync(path.join(__dirname, '../src/lib/slash.js'), 'utf8'));
  const dates = moduleUrl(`export const ymd = d => d.toISOString().slice(0,10); export const today = () => '2026-10-26'; export const nowHM = () => '10:00'; export const addDays = (s,n) => ymd(new Date(new Date(s+'T12:00:00Z').getTime()+n*86400000));`);
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/quickadd.js'), 'utf8').replace('./slash.js', slash).replace('./db.svelte.js', dates);
  return (await import(moduleUrl(source))).parseTask;
}
test('slash metadata supports quotes, repeated tags and legacy syntax', async () => {
  const parse = await parser();
  const p = parse('Study tomorrow 4pm /tag "School Work" /tag new /color blue /group "Study tasks"', [{id:'school', name:'School Work'}]);
  assert.equal(p.title, 'Study'); assert.equal(p.due, '2026-10-27'); assert.equal(p.time, '16:00');
  assert.deepEqual(p.tagIds, ['school']); assert.deepEqual(p.newTags, ['new']);
  assert.equal(p.color, '#38bdf8'); assert.equal(p.group, 'Study tasks'); assert.deepEqual(p.errors, []);
  assert.deepEqual(parse('Study tag:SchoolWork', [{id:'school', name:'School Work'}]).tagIds, ['school']);
});
test('slash dates/times validate; malformed options cannot silently add', async () => {
  const parse = await parser();
  const p = parse('Study /date "in 3 days" /time noon /color #abcdef', []);
  assert.equal(p.due, '2026-10-29'); assert.equal(p.time, '12:00'); assert.deepEqual(p.errors, []);
  for (const option of ['/tag', '/color ultraviolet', '/date 2026-02-31', '/time 99:99', '/unknown foo', '/group "unfinished']) {
    assert.ok(parse('Study ' + option, []).errors.length, option);
  }
});
