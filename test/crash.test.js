'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const { createCrashReporter, scrub } = require('../lib/crash');

test('scrub hides the home folder and any URLs', () => {
  const s = scrub(`Error at ${os.homedir()}/AppData/opentab/main.js:10 loading https://bank.example/account?id=7 and file:///C:/x`);
  assert.ok(!s.includes(os.homedir()));
  assert.ok(s.includes('~/AppData'));
  assert.ok(!s.includes('bank.example'));
  assert.equal((s.match(/<url>/g) || []).length, 2);
});

test('nothing is sent while reports are off', async () => {
  const sent = [];
  const r = createCrashReporter({ enabled: () => false, endpoint: 'x', info: () => ({}), fetch: async (...a) => sent.push(a) });
  await r.report('main-exception', new Error('boom'));
  assert.equal(sent.length, 0);
});

test('each distinct error is sent once per run', async () => {
  const sent = [];
  const r = createCrashReporter({ enabled: () => true, endpoint: 'https://e/api/crash', info: () => ({ uid: '1234567890' }), fetch: async (url, o) => sent.push([url, JSON.parse(o.body)]) });
  await r.report('main-exception', new Error('boom'));
  await r.report('main-exception', new Error('boom'));
  await r.report('main-exception', new Error('other'));
  assert.equal(sent.length, 2);
  assert.equal(sent[0][0], 'https://e/api/crash');
  assert.equal(sent[0][1].uid, '1234567890');
  assert.equal(sent[0][1].kind, 'main-exception');
  assert.equal(sent[0][1].message, 'boom');
});

test('a failing network does not throw', async () => {
  const r = createCrashReporter({ enabled: () => true, endpoint: 'x', info: () => ({}), fetch: async () => { throw new Error('offline'); } });
  await assert.doesNotReject(r.report('x', new Error('y')));
});
