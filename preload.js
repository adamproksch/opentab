'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const on = (ch, cb) => {
  const h = (_e, ...a) => cb(...a);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

contextBridge.exposeInMainWorld('opentab', {
  cmd: (name, args) => ipcRenderer.invoke('cmd', name, args),
  ready: () => ipcRenderer.invoke('ready'),
  onState: (cb) => on('state', cb),
  onBookmarks: (cb) => on('bookmarks', cb),
  onToast: (cb) => on('toast', cb),
  onFindResult: (cb) => on('find-result', cb),
  onFocusOmnibox: (cb) => on('focus-omnibox', cb),
  onOpenFind: (cb) => on('open-find', cb),
  onOpenPanel: (cb) => on('open-panel', cb),
  onLock: (cb) => on('lock', cb),
  onRenameGroup: (cb) => on('prompt-rename-group', cb),
  onRenameWorkspace: (cb) => on('prompt-rename-workspace', cb),
});
