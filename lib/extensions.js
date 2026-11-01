'use strict';
// Unpacked Chrome extensions (a folder with a manifest.json), loaded into the normal browsing session.
// Electron runs content scripts, background service workers and most chrome.* APIs, but has no
// toolbar button or popup UI for extensions, so extensions that only work through a popup won't be usable.
const fs = require('fs');
const path = require('path');

function readManifest(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { return null; }
}

function createExtensions({ session, paths, savePaths }) {
  const api = session.extensions || session; // session.extensions since Electron 36
  const loaded = new Map(); // path -> { id, name, version, error }

  async function load(dir) {
    const m = readManifest(dir);
    if (!m) { loaded.set(dir, { id: '', name: path.basename(dir), version: '', error: 'No manifest.json in this folder' }); return loaded.get(dir); }
    try {
      const ext = await api.loadExtension(dir, { allowFileAccess: false });
      loaded.set(dir, { id: ext.id, name: ext.name, version: ext.version, error: '' });
    } catch (e) {
      loaded.set(dir, { id: '', name: m.name || path.basename(dir), version: m.version || '', error: String(e && e.message || e).slice(0, 200) });
    }
    return loaded.get(dir);
  }

  async function loadAll() { for (const p of paths()) await load(p); }

  async function add(dir) {
    if (paths().includes(dir)) return loaded.get(dir);
    const r = await load(dir);
    if (!r.error) savePaths([...paths(), dir]);
    else loaded.delete(dir);
    return r;
  }

  function remove(dir) {
    const r = loaded.get(dir);
    if (r && r.id) { try { api.removeExtension(r.id); } catch { /* already gone */ } }
    loaded.delete(dir);
    savePaths(paths().filter((p) => p !== dir));
  }

  const list = () => paths().map((p) => ({ path: p, ...(loaded.get(p) || { id: '', name: path.basename(p), version: '', error: 'Not loaded' }) }));

  return { loadAll, add, remove, list };
}

module.exports = { createExtensions, readManifest };
