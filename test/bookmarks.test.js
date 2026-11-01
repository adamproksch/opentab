'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseChromiumBookmarks, exportHTML, parseHTMLBookmarks } = require('../lib/bookmarks');

const chromium = {
  roots: {
    bookmark_bar: { children: [
      { type: 'url', name: 'Example', url: 'https://example.com/' },
      { type: 'folder', name: 'Work', children: [
        { type: 'url', name: 'Docs', url: 'https://docs.example.com/' },
        { type: 'folder', name: 'Deep', children: [{ type: 'url', name: 'Deep link', url: 'https://deep.example.com/' }] },
      ] },
      { type: 'url', name: 'Script', url: 'javascript:alert(1)' },
    ] },
    other: { children: [{ type: 'url', name: '', url: 'http://other.example.com/' }] },
  },
};

test('Chromium bookmarks: folders become paths, non-web links are skipped', () => {
  const out = parseChromiumBookmarks(chromium, 'Chrome');
  assert.deepEqual(out, [
    { title: 'Example', url: 'https://example.com/', folder: 'Chrome' },
    { title: 'Docs', url: 'https://docs.example.com/', folder: 'Chrome/Work' },
    { title: 'Deep link', url: 'https://deep.example.com/', folder: 'Chrome/Work/Deep' },
    { title: 'http://other.example.com/', url: 'http://other.example.com/', folder: 'Chrome/Other bookmarks' },
  ]);
});

test('Chromium bookmarks: missing roots give an empty list', () => {
  assert.deepEqual(parseChromiumBookmarks({}, 'Edge'), []);
});

test('HTML export and import round-trip, including special characters', () => {
  const list = [
    { title: 'Top', url: 'https://top.example/', folder: '' },
    { title: 'A & B <tag> "q"', url: 'https://ab.example/?x=1&y=2', folder: 'Stuff' },
    { title: 'Nested', url: 'https://n.example/', folder: 'Stuff/Inner' },
  ];
  const back = parseHTMLBookmarks(exportHTML(list));
  assert.deepEqual(back.map(({ title, url, folder }) => ({ title, url, folder })).sort((a, b) => a.url.localeCompare(b.url)),
    list.map(({ title, url, folder }) => ({ title, url, folder })).sort((a, b) => a.url.localeCompare(b.url)));
});

test('HTML import does not double-decode entities', () => {
  const html = '<DL><p><DT><A HREF="https://x.example/">Use &amp;lt;b&amp;gt;</A></DL>';
  assert.equal(parseHTMLBookmarks(html)[0].title, 'Use &lt;b&gt;');
});

test('HTML import skips non-web links', () => {
  const html = '<DL><p><DT><A HREF="javascript:void(0)">bad</A><DT><A HREF="place:sort=8">firefox query</A><DT><A HREF="https://ok.example/">ok</A></DL>';
  assert.deepEqual(parseHTMLBookmarks(html).map((b) => b.url), ['https://ok.example/']);
});
