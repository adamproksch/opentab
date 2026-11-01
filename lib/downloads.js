'use strict';
// Download manager: progress, pause/resume/cancel, "Save as…", and a hold on files that can run code.
//
// Risky files (see isRiskyFile) download into a holding folder instead of Downloads and wait there
// until the user chooses Keep (moved into Downloads) or Discard (deleted), like Chrome's
// "this file may be dangerous" bar. Pausing alone isn't enough: small files finish before a pause lands.
// "Save as…" skips the hold, since the user picked that file and where it goes.
const path = require('path');
const fs = require('fs');
const { isRiskyFile } = require('./url');

function uniquePath(dir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let target = path.join(dir, name); let n = 1;
  while (fs.existsSync(target)) target = path.join(dir, `${base} (${n++})${ext}`);
  return target;
}

function createDownloads({ dir, holdDir, onChange, onDone, onRisky, shell }) {
  const list = [];             // newest first: { id, item, name, path, url, state, received, total, paused, risky, held, kept, private, started }
  const saveAsUrls = new Set(); // next download of these URLs asks where to save
  let seq = 0;
  let changeTimer = null;
  const changed = () => { if (!changeTimer) changeTimer = setTimeout(() => { changeTimer = null; onChange(); }, 250); };

  // a held file the user kept: move it into Downloads
  function release(d) {
    try {
      const target = uniquePath(dir(), d.name);
      fs.renameSync(d.path, target);
      d.path = target; d.name = path.basename(target); d.held = false;
      d.state = 'completed';
      onDone(d);
    } catch { d.state = 'interrupted'; }
  }
  function discardHeld(d) {
    try { if (d.path) fs.rmSync(d.path, { force: true }); } catch { /* already gone */ }
    d.held = false; d.state = 'cancelled';
  }

  function attach(ses, { isPrivate = false } = {}) {
    ses.on('will-download', (e, item) => {
      const name = item.getFilename();
      const d = {
        id: 'd' + (++seq), item, name, path: '', url: item.getURL(), state: 'progressing',
        received: 0, total: item.getTotalBytes(), paused: false, risky: isRiskyFile(name), held: false, kept: false, private: isPrivate, started: Date.now(),
      };
      if (saveAsUrls.delete(d.url)) item.setSaveDialogOptions({ title: 'Save as', defaultPath: path.join(dir(), name) });
      else if (d.risky) {
        fs.mkdirSync(holdDir(), { recursive: true });
        d.held = true; d.state = 'warning';
        item.setSavePath(path.join(holdDir(), `${d.id}-${Date.now().toString(36)}-${name}`));
        onRisky(d);
      } else item.setSavePath(uniquePath(dir(), name));
      list.unshift(d);
      if (list.length > 100) list.length = 100;

      item.on('updated', (ev, state) => {
        if (!d.held) { d.path = item.getSavePath() || d.path; d.name = d.path ? path.basename(d.path) : d.name; }
        d.received = item.getReceivedBytes(); d.total = item.getTotalBytes();
        d.paused = item.isPaused();
        if (d.state !== 'warning') d.state = state; // 'progressing' | 'interrupted'
        changed();
      });
      item.once('done', (ev, state) => {
        d.path = item.getSavePath() || d.path;
        if (!d.held) d.name = d.path ? path.basename(d.path) : d.name;
        d.received = item.getReceivedBytes();
        d.paused = false;
        d.item = null;
        if (d.held && state === 'completed') {
          // finished in the holding folder: release it if the user already said Keep, otherwise keep waiting
          if (d.kept) release(d); else d.state = 'warning';
        } else {
          if (d.held) discardHeld(d);
          d.state = state; // 'completed' | 'cancelled' | 'interrupted'
          // "Save as" dialog dismissed: nothing was downloaded, so don't list it
          if (state === 'cancelled' && !d.path) list.splice(list.indexOf(d), 1);
          if (state === 'completed') onDone(d);
        }
        changed();
      });
      changed();
    });
  }

  const find = (id) => list.find((x) => x.id === id);
  function action(id, what) {
    const d = find(id);
    if (!d) return;
    const it = d.item;
    if (what === 'keep' && d.state === 'warning') {
      if (it) { d.kept = true; d.state = 'progressing'; } // still downloading: moved to Downloads when it finishes
      else release(d);
    } else if (what === 'discard' && d.state === 'warning') {
      if (it) it.cancel(); else discardHeld(d);
    } else if (what === 'pause' && it && !it.isPaused()) it.pause();
    else if (what === 'resume' && it && it.canResume()) it.resume();
    else if (what === 'cancel' && it) it.cancel();
    else if (what === 'open' && d.state === 'completed' && d.path) shell.openPath(d.path);
    else if (what === 'show' && d.state === 'completed' && d.path) shell.showItemInFolder(d.path);
    else if (what === 'remove' && !it && d.state !== 'warning') list.splice(list.indexOf(d), 1);
    changed();
  }
  function clearFinished() {
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].item && list[i].state !== 'warning') list.splice(i, 1);
    changed();
  }
  // what the UI needs (no DownloadItem objects)
  const snapshot = () => list.map(({ id, name, state, received, total, paused, risky, private: p }) => ({ id, name, state, received, total, paused, risky, private: p }));
  const active = () => list.filter((d) => d.item && d.state === 'progressing').length;
  // private downloads vanish from the list when the last private tab closes
  const forgetPrivate = () => { for (let i = list.length - 1; i >= 0; i--) if (list[i].private && !list[i].item && list[i].state !== 'warning') list.splice(i, 1); changed(); };
  // on quit: held files nobody kept are deleted
  const cleanup = () => { try { fs.rmSync(holdDir(), { recursive: true, force: true }); } catch { /* ignore */ } };

  return { attach, action, clearFinished, snapshot, active, forgetPrivate, cleanup, saveAs: (url) => saveAsUrls.add(url) };
}

module.exports = { createDownloads, uniquePath };
