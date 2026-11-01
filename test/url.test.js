'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeInput, isRiskyFile } = require('../lib/url');

const G = 'https://www.google.com/search?q=%s';
const n = (s) => normalizeInput(s, G);

test('empty and unsafe input goes to the new tab page', () => {
  assert.equal(n(''), 'opentab://newtab');
  assert.equal(n('   '), 'opentab://newtab');
  assert.equal(n('javascript:alert(1)'), 'opentab://newtab');
  assert.equal(n('JavaScript:alert(1)'), 'opentab://newtab');
  assert.equal(n('data:text/html,<b>x</b>'), 'opentab://newtab');
  assert.equal(n('about:blank'), 'opentab://newtab');
});

test('full URLs pass through', () => {
  assert.equal(n('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(n('http://example.com'), 'http://example.com');
  assert.equal(n('opentab://newtab'), 'opentab://newtab');
});

test('bare domains get https, local addresses get http', () => {
  assert.equal(n('example.com'), 'https://example.com');
  assert.equal(n('example.com/path?q=1'), 'https://example.com/path?q=1');
  assert.equal(n('sub.example.co.uk:8443'), 'https://sub.example.co.uk:8443');
  assert.equal(n('localhost:3000'), 'http://localhost:3000');
  assert.equal(n('192.168.0.1/admin'), 'http://192.168.0.1/admin');
});

test('everything else is a search', () => {
  assert.equal(n('how to boil eggs'), 'https://www.google.com/search?q=how%20to%20boil%20eggs');
  assert.equal(n('node.js tutorial'), 'https://www.google.com/search?q=node.js%20tutorial');
  assert.equal(n('a&b=c'), 'https://www.google.com/search?q=a%26b%3Dc');
  assert.equal(normalizeInput('cats', 'https://duckduckgo.com/?q=%s'), 'https://duckduckgo.com/?q=cats');
});

test('risky file types are caught, documents are not', () => {
  for (const f of ['setup.exe', 'SETUP.EXE', 'run.bat', 'x.ps1', 'a.msi', 'link.lnk', 'disk.iso', 'macro.docm']) assert.ok(isRiskyFile(f), f);
  for (const f of ['photo.jpg', 'notes.pdf', 'archive.zip', 'doc.docx', 'README', '']) assert.ok(!isRiskyFile(f), f);
});
