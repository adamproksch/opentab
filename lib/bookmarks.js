'use strict';
// Bookmark file formats: Chromium's "Bookmarks" JSON and the Netscape HTML that every browser imports/exports.

function parseChromiumBookmarks(json, label) {
  const out = [];
  const walk = (node, folder) => {
    if (!node) return;
    if (node.type === 'url' && /^https?:/i.test(node.url || '')) out.push({ title: node.name || node.url, url: node.url, folder });
    else if (node.type === 'folder' || node.children) (node.children || []).forEach((c) => walk(c, c.type === 'folder' ? `${folder}/${c.name}` : folder));
  };
  const r = json.roots || {};
  const names = { bookmark_bar: label, other: `${label}/Other bookmarks`, synced: `${label}/Mobile bookmarks` };
  for (const key of Object.keys(names)) (r[key]?.children || []).forEach((c) => walk(c, c.type === 'folder' ? `${names[key]}/${c.name}` : names[key]));
  return out;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function exportHTML(list) {
  const tree = { items: [], kids: new Map() };
  for (const b of list) {
    let node = tree;
    for (const part of (b.folder || '').split('/').filter(Boolean)) {
      if (!node.kids.has(part)) node.kids.set(part, { items: [], kids: new Map() });
      node = node.kids.get(part);
    }
    node.items.push(b);
  }
  const render = (node, depth) => {
    const pad = '    '.repeat(depth);
    let s = '';
    for (const [name, kid] of node.kids) s += `${pad}<DT><H3>${esc(name)}</H3>\n${pad}<DL><p>\n${render(kid, depth + 1)}${pad}</DL><p>\n`;
    for (const b of node.items) s += `${pad}<DT><A HREF="${esc(b.url)}" ADD_DATE="${Math.floor((b.added || Date.now()) / 1000)}">${esc(b.title)}</A>\n`;
    return s;
  };
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${render(tree, 1)}</DL><p>\n`;
}

function parseHTMLBookmarks(html) {
  const out = []; const stack = []; let pending = null;
  const dec = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const re = /<H3[^>]*>([\s\S]*?)<\/H3>|<DL[^>]*>|<\/DL>|<A\s[^>]*?HREF="([^"]*)"[^>]*>([\s\S]*?)<\/A>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tok = m[0].toUpperCase();
    if (m[1] !== undefined) pending = dec(m[1]).trim();
    else if (tok.startsWith('<DL')) { stack.push(pending); pending = null; }
    else if (tok === '</DL>') stack.pop();
    else if (m[2] && /^https?:/i.test(m[2])) out.push({ title: dec(m[3]).trim() || m[2], url: dec(m[2]), folder: stack.filter(Boolean).join('/') });
  }
  return out;
}

module.exports = { parseChromiumBookmarks, exportHTML, parseHTMLBookmarks };
