const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { saveData } = require('../electron/persistence.cjs');
test('backup keeps previous valid save and survives corrupt live data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskboard-test-'));
  const file = path.join(dir, 'data.json');
  try {
    saveData(file, '{"tasks":[1]}');
    saveData(file, '{"tasks":[2]}');
    assert.equal(fs.readFileSync(file + '.bak', 'utf8'), '{"tasks":[1]}');
    fs.writeFileSync(file, 'broken');
    saveData(file, '{"tasks":[3]}');
    assert.equal(fs.readFileSync(file + '.bak', 'utf8'), '{"tasks":[1]}');
    assert.throws(() => saveData(file, 'invalid'));
    assert.equal(fs.readFileSync(file, 'utf8'), '{"tasks":[3]}');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('undo/redo, branching, duplicate records and bounded history', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/history.js'), 'utf8');
  const { createHistory } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const h = createHistory(2);
  for (const value of ['a', 'b', 'c', 'd']) h.record(value);
  assert.equal(h.undo(), 'c');
  h.record('c');
  assert.equal(h.redo(), 'd');
  assert.equal(h.undo(), 'c');
  assert.equal(h.undo(), 'b');
  assert.equal(h.undo(), null);
  h.record('new');
  assert.equal(h.redo(), null);
});
