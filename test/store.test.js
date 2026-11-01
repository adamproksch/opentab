'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeStore } = require('../lib/store');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'opentab-store-'));

test('uses the fallback when there is no file, and writes it on flush', () => {
  const dir = tmp();
  const s = makeStore(dir, 'a.json', () => ({ n: 1 }));
  assert.deepEqual(s.data, { n: 1 });
  s.data.n = 2; s.flush();
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'a.json'), 'utf8')), { n: 2 });
  assert.ok(!fs.existsSync(path.join(dir, 'a.json.tmp')));
});

test('reloads saved data', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'b.json'), '[1,2,3]');
  assert.deepEqual(makeStore(dir, 'b.json', []).data, [1, 2, 3]);
});

test('a corrupt file falls back instead of throwing', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'c.json'), '{nope');
  assert.deepEqual(makeStore(dir, 'c.json', { ok: true }).data, { ok: true });
});

test('save() batches writes', async () => {
  const dir = tmp();
  const s = makeStore(dir, 'd.json', { n: 0 }, { delay: 20 });
  for (let i = 1; i <= 50; i++) { s.data.n = i; s.save(); }
  assert.ok(!fs.existsSync(path.join(dir, 'd.json')));
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'd.json'), 'utf8')), { n: 50 });
});
