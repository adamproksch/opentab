'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bl = require('../blocklist');

test('hostBlocked matches the host and its subdomains', () => {
  assert.equal(bl.hostBlocked('doubleclick.net'), 'doubleclick.net');
  assert.equal(bl.hostBlocked('stats.g.doubleclick.net'), 'stats.g.doubleclick.net');
  assert.equal(bl.hostBlocked('x.y.DoubleClick.net'), 'doubleclick.net');
  assert.equal(bl.hostBlocked('example.com'), null);
  assert.equal(bl.hostBlocked('notdoubleclick.net'), null);
});

test('entries with a path are not treated as whole-host blocks', () => {
  assert.equal(bl.hostBlocked('unity3d.com'), null);
  assert.equal(bl.hostBlocked('t.co'), null);
});

test('registrable keeps the site, including two-part suffixes', () => {
  assert.equal(bl.registrable('www.example.com'), 'example.com');
  assert.equal(bl.registrable('a.b.example.com'), 'example.com');
  assert.equal(bl.registrable('example.com'), 'example.com');
  assert.equal(bl.registrable('www.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(bl.registrable('news.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(bl.registrable('user.github.io'), 'user.github.io');
  assert.equal(bl.registrable('shop.example.com.au'), 'example.com.au');
  assert.equal(bl.registrable('localhost'), 'localhost');
  assert.equal(bl.registrable('192.168.1.20'), '192.168.1.20');
  assert.equal(bl.registrable('WWW.Example.COM.'), 'example.com');
});

test('two .co.uk sites are different sites', () => {
  assert.notEqual(bl.registrable('bbc.co.uk'), bl.registrable('guardian.co.uk'));
});

test('stripTracking removes tracking params and keeps the rest', () => {
  assert.equal(bl.stripTracking('https://a.com/p?utm_source=x&id=5&fbclid=y'), 'https://a.com/p?id=5');
  assert.equal(bl.stripTracking('https://a.com/p?gclid=1'), 'https://a.com/p');
  assert.equal(bl.stripTracking('https://a.com/p?id=5'), null);
  assert.equal(bl.stripTracking('not a url'), null);
});

test('patterns catch common ad and tracker paths', () => {
  const hit = (u) => bl.PATTERNS.some((re) => re.test(u));
  assert.ok(hit('https://cdn.x.com/ads/banner/1.png'));
  assert.ok(hit('https://x.com/gtag.js?id=1'));
  assert.ok(hit('https://x.com/collect.gif'));
  assert.ok(!hit('https://x.com/images/logo.png'));
  assert.ok(!hit('https://x.com/headspace/readme'));
});
