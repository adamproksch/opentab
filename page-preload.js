'use strict';
// Runs in every tab. Only opentab:// pages (new tab, error) get a (tiny) API.
const { contextBridge, ipcRenderer } = require('electron');
// Google's sign-in page also checks the browser from JavaScript, so the Firefox identity
// main.js sends in the request header has to match what the page sees. Only on Google's account hosts.
if (location.hostname === 'accounts.google.com' || location.hostname === 'accounts.youtube.com') {
  contextBridge.executeInMainWorld({
    func: () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';
      const def = (k, v) => { try { Object.defineProperty(Navigator.prototype, k, { get: () => v, configurable: true }); } catch { /* ignore */ } };
      def('userAgent', ua);
      def('appVersion', '5.0 (Windows)');
      def('vendor', '');
      def('userAgentData', undefined);
      try { delete window.chrome; } catch { /* ignore */ }
    },
  });
}
if (location.protocol === 'opentab:') {
  contextBridge.exposeInMainWorld('opentabInternal', {
    home: () => ipcRenderer.invoke('page:home'),
    go: (text) => ipcRenderer.invoke('page:go', String(text || '')),
    panel: (name) => ipcRenderer.invoke('page:panel', String(name)),
    open: (url) => ipcRenderer.invoke('page:open', String(url)),
    activate: (id) => ipcRenderer.invoke('page:activate', String(id)),
    closeTab: (id) => ipcRenderer.invoke('page:closeTab', String(id)),
    saveNotes: (text) => ipcRenderer.invoke('page:notes', String(text)),
  });
}
