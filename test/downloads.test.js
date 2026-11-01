'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDownloads, uniquePath } = require('../lib/downloads');

// a stand-in for Electron's DownloadItem
class FakeItem extends EventEmitter {
  constructor(name, url = 'https://x.example/' + name, total = 100) {
    super(); this.name = name; this.url = url; this.total = total; this.received = 0; this.paused = false; this.savePath = ''; this.dialog = null; this.cancelled = false;
  }
  getFilename() { return this.name; } getURL() { return this.url; } getTotalBytes() { return this.total; } getReceivedBytes() { return this.received; }
  setSavePath(p) { this.savePath = p; } getSavePath() { return this.savePath; } setSaveDialogOptions(o) { this.dialog = o; }
  pause() { this.paused = true; } resume() { this.paused = false; } isPaused() { return this.paused; } canResume() { return true; }
  cancel() { this.cancelled = true; this.emit('done', {}, 'cancelled'); }
}

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opentab-dl-'));
  const hold = path.join(dir, '.held');
  const events = { done: [], risky: [], opened: [] };
  const ses = new EventEmitter();
  const dl = createDownloads({
    dir: () => dir, holdDir: () => hold, onChange: () => {}, onDone: (d) => events.done.push(d.name), onRisky: (d) => events.risky.push(d.name),
    shell: { openPath: (p) => events.opened.push(p), showItemInFolder: () => {} },
  });
  dl.attach(ses);
  const start = (item) => { ses.emit('will-download', {}, item); return item; };
  return { dir, dl, start, events };
}

test('uniquePath numbers files that already exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opentab-u-'));
  assert.equal(uniquePath(dir, 'a.txt'), path.join(dir, 'a.txt'));
  fs.writeFileSync(path.join(dir, 'a.txt'), '');
  fs.writeFileSync(path.join(dir, 'a (1).txt'), '');
  assert.equal(uniquePath(dir, 'a.txt'), path.join(dir, 'a (2).txt'));
});

test('a normal download saves into the folder and reports progress and completion', () => {
  const { dir, dl, start, events } = setup();
  const it = start(new FakeItem('photo.jpg'));
  assert.equal(it.savePath, path.join(dir, 'photo.jpg'));
  it.received = 40; it.emit('updated', {}, 'progressing');
  assert.equal(dl.snapshot()[0].received, 40);
  assert.equal(dl.active(), 1);
  it.received = 100; it.emit('done', {}, 'completed');
  assert.equal(dl.snapshot()[0].state, 'completed');
  assert.deepEqual(events.done, ['photo.jpg']);
  assert.equal(dl.active(), 0);
  dl.action(dl.snapshot()[0].id, 'open');
  assert.deepEqual(events.opened, [path.join(dir, 'photo.jpg')]);
});

// finish a fake download: write the file where it was told to save, then report done
const finish = (it) => { fs.writeFileSync(it.savePath, 'x'); it.received = it.total; it.emit('done', {}, 'completed'); };

test('risky files land in the holding folder, not Downloads, until kept', () => {
  const { dir, dl, start, events } = setup();
  const it = start(new FakeItem('setup.exe'));
  assert.ok(!it.savePath.startsWith(path.join(dir, 'setup')), 'not saved straight into Downloads');
  assert.ok(it.savePath.includes('.held'));
  assert.equal(dl.snapshot()[0].state, 'warning');
  assert.deepEqual(events.risky, ['setup.exe']);
  // progress and even finishing don't clear the warning
  it.emit('updated', {}, 'progressing');
  finish(it);
  assert.equal(dl.snapshot()[0].state, 'warning');
  assert.ok(!fs.existsSync(path.join(dir, 'setup.exe')));
  assert.deepEqual(events.done, []);
  dl.action(dl.snapshot()[0].id, 'keep');
  assert.equal(dl.snapshot()[0].state, 'completed');
  assert.ok(fs.existsSync(path.join(dir, 'setup.exe')));
  assert.deepEqual(events.done, ['setup.exe']);
});

test('Keep while a risky file is still downloading moves it when it finishes', () => {
  const { dir, dl, start } = setup();
  const it = start(new FakeItem('tool.msi'));
  dl.action(dl.snapshot()[0].id, 'keep');
  assert.equal(dl.snapshot()[0].state, 'progressing');
  finish(it);
  assert.equal(dl.snapshot()[0].state, 'completed');
  assert.ok(fs.existsSync(path.join(dir, 'tool.msi')));
});

test('Discard deletes a held file, finished or not', () => {
  const { dir, dl, start } = setup();
  const done = start(new FakeItem('evil.bat'));
  finish(done);
  const heldPath = done.savePath;
  dl.action(dl.snapshot()[0].id, 'discard');
  assert.equal(dl.snapshot()[0].state, 'cancelled');
  assert.ok(!fs.existsSync(heldPath));
  assert.ok(!fs.existsSync(path.join(dir, 'evil.bat')));

  const running = start(new FakeItem('evil2.bat'));
  dl.action(dl.snapshot()[0].id, 'discard');
  assert.ok(running.cancelled);
  assert.equal(dl.snapshot()[0].state, 'cancelled');
});

test('held files are not cleared from the list until decided, and cleanup empties the hold', () => {
  const { dl, start } = setup();
  const it = start(new FakeItem('x.exe'));
  finish(it);
  dl.clearFinished();
  assert.equal(dl.snapshot().length, 1);
  dl.cleanup();
  assert.ok(!fs.existsSync(it.savePath));
});

test('"Save as" asks for a location instead of saving straight away', () => {
  const { dl, start } = setup();
  dl.saveAs('https://x.example/report.pdf');
  const it = start(new FakeItem('report.pdf'));
  assert.equal(it.savePath, '');
  assert.ok(it.dialog && it.dialog.defaultPath.endsWith('report.pdf'));
  // dismissing the dialog cancels with no path: nothing stays in the list
  it.emit('done', {}, 'cancelled');
  assert.equal(dl.snapshot().length, 0);
  // the next download of that URL saves normally again
  assert.ok(start(new FakeItem('report.pdf')).savePath);
});

test('pause, resume, cancel and clearing finished downloads', () => {
  const { dl, start } = setup();
  const it = start(new FakeItem('big.zip'));
  const id = dl.snapshot()[0].id;
  dl.action(id, 'pause'); assert.ok(it.paused);
  dl.action(id, 'resume'); assert.ok(!it.paused);
  dl.action(id, 'remove'); assert.equal(dl.snapshot().length, 1, 'a running download cannot be removed');
  dl.action(id, 'cancel'); assert.ok(it.cancelled);
  start(new FakeItem('other.zip'));
  dl.clearFinished();
  assert.deepEqual(dl.snapshot().map((d) => d.name), ['other.zip']);
});
