'use strict';
const {
  app, BaseWindow, WebContentsView, session, ipcMain, Menu, Tray, nativeImage, nativeTheme,
  dialog, shell, Notification, protocol, clipboard, screen, BrowserWindow, net,
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const blocklist = require('./blocklist');
const Spotify = require('./spotify');
const storeLib = require('./lib/store');
const bookmarkFiles = require('./lib/bookmarks');
const { normalizeInput: normalizeUrl } = require('./lib/url');
const { createDownloads } = require('./lib/downloads');
const { createCrashReporter } = require('./lib/crash');
const { createExtensions } = require('./lib/extensions');
// Comprehensive ad/tracker blocking via the Ghostery engine (EasyList, EasyPrivacy,
// uBlock and Peter Lowe lists). Falls back to the small built-in list if unavailable.
let ElectronBlocker = null, AdRequest = null, adEngine = null;
try { ({ ElectronBlocker, Request: AdRequest } = require('@ghostery/adblocker-electron')); } catch (e) { console.error('adblocker engine unavailable:', e && e.message); }
const GH_TYPE = { mainFrame: 'main_frame', subFrame: 'sub_frame', stylesheet: 'stylesheet', script: 'script', image: 'image', font: 'font', object: 'object', xhr: 'xmlhttprequest', ping: 'ping', cspReport: 'csp_report', media: 'media', webSocket: 'websocket', other: 'other' };
// Filter levels: "standard" is ads + trackers; "strict" adds annoyances and cookie-banner lists.
const FILTER_LEVELS = {
  standard: { file: 'adblock-engine.bin', build: () => ElectronBlocker.fromPrebuiltAdsAndTracking(fetch) },
  strict: { file: 'adblock-engine-strict.bin', build: () => ElectronBlocker.fromPrebuiltFull(fetch) },
};
let adLists = { status: 'loading', updated: 0 }; // shown in Settings → Privacy
async function setupAdblock(force) {
  if (!ElectronBlocker) { adLists = { status: 'unavailable', updated: 0 }; return; }
  const level = FILTER_LEVELS[settings.filterLevel] || FILTER_LEVELS.standard;
  const cache = path.join(app.getPath('userData'), level.file);
  let fresh = false;
  adEngine = null;
  try {
    const st = fs.statSync(cache);
    adEngine = ElectronBlocker.deserialize(new Uint8Array(fs.readFileSync(cache)));
    fresh = (Date.now() - st.mtimeMs) < 7 * 864e5;
    adLists = { status: 'ok', updated: st.mtimeMs };
  } catch { /* no cache yet */ }
  if (!adEngine || !fresh || force) {
    adLists = { ...adLists, status: 'updating' }; pushState();
    try {
      const built = await level.build();
      adEngine = built;
      try { fs.writeFileSync(cache, Buffer.from(built.serialize())); } catch { /* ignore */ }
      adLists = { status: 'ok', updated: Date.now() };
    } catch (e) {
      console.error('ad lists failed to load (using fallback):', e && e.message);
      adLists = { ...adLists, status: adEngine ? 'ok' : 'error' };
      if (force) toast('Couldn’t update the filter lists');
    }
  }
  pushState();
}

// ───────────────────────────────────────────────────────────── low-resource startup flags
// Cap Chromium's on-disk caches so they don't grow unbounded (less disk I/O and memory-mapped cache).
app.commandLine.appendSwitch('disk-cache-size', String(100 * 1024 * 1024));
app.commandLine.appendSwitch('media-cache-size', String(100 * 1024 * 1024));

// Hardware acceleration can only be toggled before the app is ready, so the saved
// "low power mode" preference has to be read synchronously, ahead of the normal store setup.
(function applyLowPowerModeIfEnabled() {
  try {
    const p = path.join(app.getPath('userData'), 'settings.json');
    const saved = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (saved && saved.lowPowerMode) app.disableHardwareAcceleration();
  } catch { /* no settings yet */ }
})();

// ───────────────────────────────────────────────────────────── constants
const APP_NAME = 'opentab';
const BOOKMARKS_BAR_H = 32;
// [tab strip, toolbar] heights per density. ui.css uses the same numbers.
const DENSITY = { compact: [34, 38], comfy: [40, 44], roomy: [46, 50] };
const UPDATE_CHECK_MS = 4 * 60 * 60 * 1000;
const SCHEME = 'opentab';

const THEMES = {
  ink:      { bg: '#181818', fg: '#f2f2f2', dark: true },
  graphite: { bg: '#232323', fg: '#ededed', dark: true },
  mono:     { bg: '#000000', fg: '#f2f2f2', dark: true },
  smoke:    { bg: '#e9e9e9', fg: '#1c1c1c', dark: false },
  chalk:    { bg: '#ffffff', fg: '#181818', dark: false },
  custom:   { bg: '#181818', fg: '#f2f2f2', dark: true }, // filled from settings.customBg / customFg
};

const SEARCH_ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  google:     { name: 'Google',     url: 'https://www.google.com/search?q=%s' },
  brave:      { name: 'Brave',      url: 'https://search.brave.com/search?q=%s' },
  bing:       { name: 'Bing',       url: 'https://www.bing.com/search?q=%s' },
  ecosia:     { name: 'Ecosia',     url: 'https://www.ecosia.org/search?q=%s' },
  startpage:  { name: 'Startpage',  url: 'https://www.startpage.com/do/search?q=%s' },
};

const DEFAULT_SETTINGS = {
  theme: 'ink',
  accent: 'auto',
  customBg: '#1b2433',         // custom theme window colour
  customFg: '#eef2f7',         // custom theme text colour
  tabStyle: 'pill',
  tabPosition: 'top',
  sideWidth: 240,
  density: 'comfy',
  corners: 'round',
  font: 'sans',
  autoUpdate: true,
  // new tab page: background is 'theme', a hex color, 'grad:<name>' or 'image'
  workspaces: false,
  sidebar: 'left',            // left | right | off
  sidebarMode: 'overlay',     // overlay floats over the page, docked pushes it aside
  panelWidth: 380,
  sidebarItems: [{ id: 'bookmarks', type: 'builtin' }, { id: 'history', type: 'builtin' }, { id: 'tabs', type: 'builtin' }, { id: 'notes', type: 'builtin' }],
  notes: '',
  mediaDock: false,
  musicMode: 'open',
  musicPins: [],               // pinned Spotify playlists/albums: [{ uri, name }]          // music player: open (bottom-right card) | mini (in the toolbar) | closed
  toolbarOrder: ['back', 'fwd', 'reload', 'omni', 'grow', 'menu'],
  ntBackground: 'theme',
  ntDim: 30,
  ntShortcuts: false,
  ntClock: true,
  ntLogo: true,
  searchEngine: 'google',
  settingsVersion: 3,
  userId: '',
  adblock: true,
  stripParams: true,
  cosmetic: true,
  sendGpc: true,
  notifications: true,
  runInBackground: true,
  bookmarksBar: false,
  sleepMinutes: 10,
  lowPowerMode: false,
  autoSync: false,
  syncSources: ['chrome', 'edge'],
  allowlist: [],
  totalBlocked: 0,
  lastSync: 0,
  bounds: null,
  maximized: false,
  filterLevel: 'standard',     // standard | strict (adds annoyances + cookie banners)
  extensions: [],              // folders of unpacked extensions
  crashReports: false,         // opt-in
  lastVersion: '',             // version that last ran, for "what's new" after an update
  updateNotes: null,           // { version, text } saved when an update downloads
};

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// ───────────────────────────────────────────────────────────── tiny JSON store (lib/store.js)
const makeStore = (file, fallback) => storeLib.makeStore(app.getPath('userData'), file, fallback);

// ───────────────────────────────────────────────────────────── globals
let settingsStore, bookmarksStore, historyStore, sessionStore, permStore;
let settings;
let win = null, ui = null, tray = null;
let tabSession = null;
let privateSession = null; // in-memory only: nothing from private tabs touches the disk
let quitting = false;
let overlayOpen = false;
let htmlFullscreen = false;
let toastOpen = false;
let toastTimer = null;
let findState = { text: '', active: 0, matches: 0 };

const downloads = createDownloads({
  dir: () => app.getPath('downloads'),
  holdDir: () => path.join(app.getPath('userData'), 'held-downloads'),
  shell,
  onChange: () => pushState(),
  onDone: (d) => {
    if (win && win.isFocused()) return toast(`Downloaded ${d.name}`);
    const n = new Notification({ title: 'Download complete', body: d.name, icon: appIcon() });
    n.on('click', () => shell.showItemInFolder(d.path));
    n.show();
  },
  onRisky: (d) => {
    toast(`${d.name} can run programs on your PC. Keep it?`);
    if (ui && !ui.webContents.isDestroyed()) { setOverlay(true); ui.webContents.send('open-panel', 'downloads'); }
  },
});
const crash = createCrashReporter({
  enabled: () => !!(settings && settings.crashReports && app.isPackaged),
  endpoint: 'https://www.opentab.cc/api/crash',
  info: () => ({ uid: settings.userId, appVersion: app.getVersion(), platform: process.platform, osVersion: require('os').release() }),
  fetch: (...a) => net.fetch(...a),
});
crash.install(app);
let extensions = null;

const tabs = [];                    // ordered
const tabById = new Map();
const wcToTab = new Map();          // webContents.id -> tab
let workspaces = [];
let groups = [];
let activeWorkspaceId = null;
const closedStack = [];
let uidCounter = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

// ───────────────────────────────────────────────────────────── helpers
const isInternal = (url) => typeof url === 'string' && url.startsWith(SCHEME + '://');
const isVertical = () => settings.tabPosition === 'left' || settings.tabPosition === 'right';
const chromeHeight = () => {
  const [tab, tool] = DENSITY[settings.density] || DENSITY.comfy;
  return tab + tool + (settings.bookmarksBar ? BOOKMARKS_BAR_H : 0);
};
// ── colour helpers (custom theme + picking colours from a background image)
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const luma = (h) => { const [r, g, b] = hexRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const isHex = (h) => /^#[0-9a-f]{6}$/i.test(h || '');
function syncCustomTheme() {
  const bg = isHex(settings.customBg) ? settings.customBg : '#181818';
  const fg = isHex(settings.customFg) ? settings.customFg : (luma(bg) < 0.5 ? '#f2f2f2' : '#181818');
  THEMES.custom = { bg, fg, dark: luma(bg) < 0.5 };
}

// Pick colours from an image: a background tone from its average colour and an accent from its most vivid colour.
function paletteFromImage(file) {
  const img = nativeImage.createFromPath(file);
  if (img.isEmpty()) return null;
  const small = img.resize({ width: 48, height: 48, quality: 'good' });
  const buf = small.toBitmap(); // BGRA
  let sr = 0, sg = 0, sb = 0, n = 0;
  const buckets = new Map();
  for (let i = 0; i < buf.length; i += 4) {
    const b = buf[i], g = buf[i + 1], r = buf[i + 2], a = buf[i + 3];
    if (a < 128) continue;
    sr += r; sg += g; sb += b; n++;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0, val = max / 255;
    if (val < 0.2 || sat < 0.25) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, score: 0 };
    e.r += r; e.g += g; e.b += b; e.n++; e.score += sat * val;
    buckets.set(key, e);
  }
  if (!n) return null;
  const avg = [sr / n, sg / n, sb / n];
  const dark = (0.299 * avg[0] + 0.587 * avg[1] + 0.114 * avg[2]) / 255 < 0.55;
  // window colour: the image's average tone pushed darker (dark images) or lighter (light images)
  const bg = dark ? rgbHex(avg[0] * 0.32 + 8, avg[1] * 0.32 + 8, avg[2] * 0.32 + 10) : rgbHex(avg[0] * 0.25 + 190, avg[1] * 0.25 + 190, avg[2] * 0.25 + 190);
  const fg = dark ? rgbHex(avg[0] * 0.08 + 232, avg[1] * 0.08 + 232, avg[2] * 0.08 + 234) : rgbHex(avg[0] * 0.1 + 16, avg[1] * 0.1 + 16, avg[2] * 0.1 + 18);
  let best = null;
  for (const e of buckets.values()) if (e.n >= 3 && (!best || e.score > best.score)) best = e;
  let accent = best ? rgbHex(best.r / best.n, best.g / best.n, best.b / best.n) : fg;
  // keep the accent readable against the window colour
  if (Math.abs(luma(accent) - luma(bg)) < 0.3) {
    const [r, g, b] = hexRgb(accent);
    accent = dark ? rgbHex(r + (255 - r) * 0.45, g + (255 - g) * 0.45, b + (255 - b) * 0.45) : rgbHex(r * 0.55, g * 0.55, b * 0.55);
  }
  return { bg, fg, accent };
}
function matchColorsToImage(quiet) {
  const p = paletteFromImage(BG_FILE());
  if (!p) { if (!quiet) toast('Could not read colours from that image'); return; }
  settings.customBg = p.bg; settings.customFg = p.fg;
  setSetting('accent', p.accent);
  setSetting('theme', 'custom');
  toast('Colours matched to your background');
}

// "auto" accent follows the theme's text color; custom accents get readable text on top
function accentColors() {
  const t = THEMES[settings.theme] || THEMES.ink;
  if (settings.accent === 'auto' || !/^#[0-9a-f]{6}$/i.test(settings.accent)) return { accent: t.fg, on: t.bg };
  const n = parseInt(settings.accent.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return { accent: settings.accent, on: lum > 0.6 ? '#181818' : '#ffffff' };
}
const wsActive = () => workspaces.find((w) => w.id === activeWorkspaceId);
const activeTab = () => tabById.get(wsActive()?.activeTabId) || null;
const wsTabs = (wid) => tabs.filter((t) => t.workspaceId === wid);

function normalizeInput(raw) {
  return normalizeUrl(raw, (SEARCH_ENGINES[settings.searchEngine] || SEARCH_ENGINES.google).url);
}

function hostOf(url) { try { return new URL(url).hostname; } catch { return ''; } }
function siteKey(url) { return blocklist.registrable(hostOf(url)); }
function siteBlockingOn(url) {
  if (!settings.adblock) return false;
  return !settings.allowlist.includes(siteKey(url));
}

// ───────────────────────────────────────────────────────────── settings
function setSetting(key, value) {
  if (!(key in DEFAULT_SETTINGS)) return;
  settings[key] = value;
  settingsStore.save();
  if (key === 'customBg' || key === 'customFg') { syncCustomTheme(); if (settings.theme !== 'custom') setSetting('theme', 'custom'); }
  if (key === 'theme' || key === 'customBg' || key === 'customFg') applyTheme();
  if (['bookmarksBar', 'tabPosition', 'sideWidth', 'density'].includes(key)) layout();
  if (key === 'autoUpdate' && value) checkForUpdates(false);
  if (key === 'autoSync') scheduleAutoSync();
  if (key === 'runInBackground') updateTray();
  if (key === 'lowPowerMode') toast('Restart to apply');
  if (key === 'workspaces' && !value) mergeWorkspaces();
  if (key === 'filterLevel') setupAdblock();
  if (['sidebar', 'sidebarMode', 'panelWidth', 'mediaDock', 'musicMode'].includes(key)) {
    if (key === 'sidebar' && value === 'off') activePanel = null;
    if (key === 'mediaDock') { if (value) startMedia(); else stopMedia(); }
    if (key === 'musicMode' && spotify) spotify.poll();
    layout();
  }
  if (key.startsWith('nt') || ['theme', 'accent', 'corners', 'font', 'customBg', 'customFg'].includes(key)) reloadNewTabs();
  pushState();
}

// with workspaces turned off, every tab lives in the current workspace
function mergeWorkspaces() {
  for (const t of tabs) t.workspaceId = activeWorkspaceId;
  const ws = wsActive();
  if (!tabById.has(ws.activeTabId)) ws.activeTabId = tabs[0]?.id || null;
  pushState(); saveSession();
}

// a tab dragged out of the window becomes its own window
function detachTab(id) {
  const t = tabById.get(id);
  if (!t || isInternal(t.url)) return;
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  if (p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height) return;
  const w = new BrowserWindow({
    x: p.x - 120, y: p.y - 20, width: Math.min(1100, b.width), height: Math.min(760, b.height),
    icon: appIcon(), autoHideMenuBar: true, backgroundColor: (THEMES[settings.theme] || THEMES.ink).bg,
    webPreferences: { session: t.private ? privateSession : tabSession, contextIsolation: true, sandbox: true },
  });
  w.webContents.setWindowOpenHandler((d) => { if (/^https?:/i.test(d.url)) createTab({ url: d.url, private: t.private }); return { action: 'deny' }; });
  w.webContents.on('page-title-updated', (e, title) => w.setTitle(title + ' - opentab'));
  w.loadURL(t.url).catch(() => {});
  closeTab(t.id, { keepClosed: false });
}

function reloadNewTabs() {
  for (const t of tabs) {
    const wc = t.view?.webContents;
    if (wc && !wc.isDestroyed() && wc.getURL().startsWith(SCHEME + '://newtab')) wc.reload();
  }
}

const BG_FILE = () => path.join(app.getPath('userData'), 'background');
async function pickBackground() {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a background', filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return;
  try { fs.copyFileSync(r.filePaths[0], BG_FILE()); } catch { return toast('Could not use that image'); }
  setSetting('ntBackground', 'image');
  matchColorsToImage(true);
}

function applyTheme() {
  syncCustomTheme();
  const t = THEMES[settings.theme] || THEMES.ink;
  nativeTheme.themeSource = t.dark ? 'dark' : 'light';
  if (win) win.setBackgroundColor(t.bg);
}

// ───────────────────────────────────────────────────────────── state push to UI
let pushTimer = null;
let lastStateJson = '';
function pushState() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => { pushTimer = null; sendState(); }, 24);
}

function tabSnapshot(t) {
  const wc = t.view && !t.view.webContents.isDestroyed() ? t.view.webContents : null;
  return {
    id: t.id, title: t.title, url: isInternal(t.url) ? '' : t.url, favicon: t.favicon,
    loading: t.loading, pinned: t.pinned, groupId: t.groupId, audible: t.audible, muted: t.muted,
    private: t.private, badge: t.badge, sleeping: t.sleeping, hasMedia: t.hasMedia, blocked: t.blocked, crashed: t.crashed,
    canGoBack: wc ? wc.navigationHistory.canGoBack() : false,
    canGoForward: wc ? wc.navigationHistory.canGoForward() : false,
    authSignin: isAuthUrl(t.url),
  };
}

function sendState() {
  if (!ui || ui.webContents.isDestroyed()) return;
  const ws = wsActive();
  const at = activeTab();
  const url = at?.url || '';
  const { notes, ...uiSettings } = settings; // notes can be large and the UI never reads them
  const st = {
    settings: uiSettings,
    sidebarItems: settings.sidebarItems.map((x) => ({ ...x, title: x.title || BUILTIN_TITLES[x.id] || hostOf(x.url), badge: panelBadges[x.id] || 0, open: panels.has(x.id) })),
    activePanel, media, editMode,
    spotify: spotify ? spotify.snapshot() : null,
    canAddPanel: !!activeTab() && !isInternal(activeTab().url),
    custom: { bg: THEMES.custom.bg, fg: THEMES.custom.fg, dark: THEMES.custom.dark },
    accentColor: accentColors().accent,
    onAccent: accentColors().on,
    chromeH: chromeHeight(),
    update,
    themes: Object.keys(THEMES),
    engines: Object.fromEntries(Object.entries(SEARCH_ENGINES).map(([k, v]) => [k, v.name])),
    workspaces: workspaces.map((w) => ({ ...w, count: wsTabs(w.id).length })),
    activeWorkspaceId,
    groups: groups.filter((g) => g.workspaceId === activeWorkspaceId),
    tabs: wsTabs(activeWorkspaceId).map(tabSnapshot),
    activeTabId: ws?.activeTabId || null,
    bookmarked: !!url && !isInternal(url) && bookmarksStore.data.some((b) => b.url === url),
    siteBlocking: url && !isInternal(url) ? siteBlockingOn(url) : null,
    site: url && !isInternal(url) ? siteKey(url) : '',
    secure: url.startsWith('https://'),
    internal: isInternal(url),
    overlayOpen,
    fullscreen: htmlFullscreen,
    maximized: win ? win.isMaximized() : false,
    platform: process.platform,
    version: app.getVersion(),
    userId: settings.userId,
    notice: currentNotice,
    telemetry: { platform: process.platform, osVersion: os.release(), arch: process.arch, locale: app.getLocale(), device: os.hostname() },
    blocklistSize: blocklist.size(),
    adLists,
    blockedHosts: at?.blockedHosts ? [...at.blockedHosts].sort((a, b) => b[1] - a[1]).slice(0, 8) : [],
    downloads: downloads ? downloads.snapshot() : [],
    permPrompt: visiblePermPrompt(),
    sitePerms: Object.entries(permStore.data).map(([k, allow]) => { const [origin, permission] = k.split('|'); return { key: k, origin, permission, label: PERM_LABEL[permission] || permission, allow }; }),
    extensions: extensions ? extensions.list() : [],
    whatsNew,
  };
  // skip the IPC + full UI re-render when nothing actually changed
  const json = JSON.stringify(st);
  if (json === lastStateJson) return;
  lastStateJson = json;
  for (const v of [ui, side, dockMedia]) if (v && !v.webContents.isDestroyed()) v.webContents.send('state', st);
}
const BUILTIN_TITLES = { bookmarks: 'Bookmarks', history: 'History', tabs: 'Tabs', notes: 'Notes' };

function sendBookmarks() {
  if (ui && !ui.webContents.isDestroyed()) ui.webContents.send('bookmarks', bookmarksStore.data);
}

function toast(msg) {
  if (!ui || ui.webContents.isDestroyed()) return;
  ui.webContents.send('toast', msg);
  toastOpen = !isVertical(); layout();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastOpen = false; layout(); }, 2800);
}

// ───────────────────────────────────────────────────────────── layout
function layout() {
  if (!win || !ui) return;
  const [w, h] = win.getContentSize();
  const ch = chromeHeight();
  const full = htmlFullscreen;
  // carve the window up from the edges: icon strip, vertical tabs, docked panel, then the page
  let L = 0, R = w;
  const strip = sidebarOn() && !full;
  const stripLeft = settings.sidebar !== 'right';
  if (strip) { if (stripLeft) L += SIDE_W; else R -= SIDE_W; }
  const sw = Math.min(settings.sideWidth, Math.max(0, w - 200));
  let uiBox;
  if (isVertical()) {
    if (settings.tabPosition === 'left') { uiBox = { x: L, y: 0, width: sw, height: h }; L += sw; }
    else { uiBox = { x: R - sw, y: 0, width: sw, height: h }; R -= sw; }
  } else uiBox = { x: 0, y: 0, width: w, height: ch + (toastOpen ? 56 : 0) + (visiblePermPrompt() ? PERM_BAR_H : 0) };
  const top = isVertical() ? 0 : ch;
  if (side) { side.setVisible(strip); if (strip) side.setBounds({ x: stripLeft ? 0 : w - SIDE_W, y: top, width: SIDE_W, height: Math.max(0, h - top) }); }
  const pw = Math.min(settings.panelWidth, Math.max(240, R - L - 320));
  let panelBox = null;
  if (activePanel && strip) {
    if (settings.sidebarMode === 'docked') {
      if (stripLeft) { panelBox = { x: L, y: top, width: pw, height: h - top }; L += pw; } else { panelBox = { x: R - pw, y: top, width: pw, height: h - top }; R -= pw; }
    } else panelBox = { x: stripLeft ? L + 8 : R - pw - 8, y: top + 8, width: pw, height: Math.max(0, h - top - 16) };
  }
  const page = full ? { x: 0, y: 0, width: w, height: h } : { x: L, y: top, width: Math.max(0, R - L), height: Math.max(0, h - top) };

  // music player card in the bottom-right corner (when minimised it lives in the toolbar instead)
  if (dockMedia) {
    const show = settings.mediaDock && settings.musicMode === 'open' && !full && !editMode && !locked;
    dockMedia.setVisible(show);
    if (show) {
      const bw = 340, bh = 470;
      dockMedia.setBounds({ x: page.x + page.width - bw - 12, y: page.y + page.height - bh - 12, width: bw, height: bh });
    }
  }
  for (const [id, v] of panels) {
    if (v.webContents.isDestroyed()) continue;
    const box = id === activePanel && panelBox ? panelBox : null;
    v.setVisible(!!box && !full);
    if (box) v.setBounds(box);
  }

  if (locked && lockView && !lockView.webContents.isDestroyed()) {
    lockView.setVisible(true);
    lockView.setBounds({ x: 0, y: 0, width: w, height: h });
    for (const t of tabs) if (t.view) t.view.setVisible(false);
    if (side) side.setVisible(false);
    if (dockMedia) dockMedia.setVisible(false);
  }
  if (full) {
    ui.setVisible(false);
  } else {
    ui.setVisible(true);
    ui.setBounds(overlayOpen ? { x: 0, y: 0, width: w, height: h } : uiBox);
  }
  const at = activeTab();
  for (const t of tabs) {
    if (!t.view) continue;
    const show = t === at;
    t.view.setVisible(show);
    if (show) {
      t.view.setBounds(htmlFullscreen
        ? { x: 0, y: 0, width: w, height: h }
        : page);
    }
  }
}

function setOverlay(open) {
  open = !!open;
  if (open === overlayOpen) return;
  overlayOpen = open;
  if (open) restack();
  layout();
  if (!open) {
    const at = activeTab();
    if (at?.view && !htmlFullscreen) at.view.webContents.focus();
  }
  pushState();
}

// ───────────────────────────────────────────────────────────── tabs
function newTabObject(opts) {
  return {
    id: uid('t'), view: null, url: opts.url || 'opentab://newtab', title: opts.title || 'New Tab',
    favicon: opts.favicon || '', loading: false, pinned: !!opts.pinned, groupId: opts.groupId || null,
    workspaceId: opts.workspaceId || activeWorkspaceId, audible: false, muted: false, badge: 0,
    sleeping: true, hasMedia: false, blocked: 0, crashed: false, lastActive: Date.now(), openerId: opts.openerId || null,
    private: !!opts.private,
  };
}

function ensureView(t) {
  if (t.view && !t.view.webContents.isDestroyed()) return t.view;
  const view = new WebContentsView({
    webPreferences: {
      session: t.private ? privateSession : tabSession,
      preload: path.join(__dirname, 'page-preload.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: true,
    },
  });
  view.setVisible(false);
  t.view = view;
  t.sleeping = false;
  t.crashed = false;
  const wc = view.webContents;
  wcToTab.set(wc.id, t);
  wireTab(t, wc);
  win.contentView.addChildView(view, 0); // keep the browser UI above web content
  wc.setAudioMuted(t.muted);
  wc.loadURL(t.url).catch(() => { /* handled by did-fail-load */ });
  return view;
}

function wireTab(t, wc) {
  const refresh = () => pushState();

  wc.on('page-title-updated', (e, title) => {
    t.title = title || t.title;
    const m = /^\((\d{1,3}\+?)\)/.exec(title || '');
    t.badge = m ? parseInt(m[1], 10) || 1 : 0;
    const h = !t.private && historyStore.data.find((x) => x.url === t.url);
    if (h) { h.title = title; historyStore.save(); }
    refresh();
  });
  wc.on('page-favicon-updated', (e, favs) => { t.favicon = favs && favs[0] ? favs[0] : ''; refresh(); });
  wc.on('did-start-loading', () => { t.loading = true; refresh(); });
  wc.on('did-stop-loading', () => { t.loading = false; refresh(); });
  wc.on('did-start-navigation', (d) => {
    if (d.isMainFrame && !d.isSameDocument) {
      // keep navigator.userAgent consistent with the header while on Google's sign-in pages
      const ua = isGoogleAuthHost(d.url) ? FIREFOX_UA : CHROME_UA();
      if (wc.getUserAgent() !== ua) wc.setUserAgent(ua);
      t.blocked = 0; t.blockedHosts = null; t.hasMedia = false; t.crashed = false;
      // a permission asked for by the previous page no longer applies
      dropPermPrompts((p) => p.wcId === wc.id && p.origin !== originOf(d.url));
      if (d.url && !d.url.startsWith(SCHEME + '://error')) t.url = d.url;
      refresh();
    }
  });
  const onNav = (e, url) => {
    if (!url) return;
    if (url.startsWith(SCHEME + '://error')) return;
    t.url = url;
    if (isInternal(url)) { t.title = url.includes('newtab') ? 'New Tab' : t.title; t.favicon = ''; }
    else if (!t.private) recordHistory(url, wc.getTitle());
    refresh();
  };
  wc.on('did-navigate', onNav);
  wc.on('did-navigate-in-page', (e, url, isMain) => { if (isMain) onNav(e, url); });
  wc.on('dom-ready', () => {
    const url = wc.getURL();
    if (settings.adblock && settings.cosmetic && !isInternal(url) && siteBlockingOn(url)) {
      if (adEngine) {
        try {
          const hn = hostOf(url);
          const { styles } = adEngine.getCosmeticsFilters({ url, hostname: hn, domain: blocklist.registrable(hn), getBaseRules: true, getRulesFromHostname: true, getRulesFromDOM: false });
          if (styles) wc.insertCSS(styles).catch(() => {});
        } catch { /* ignore */ }
      }
      wc.insertCSS(blocklist.COSMETIC_CSS).catch(() => {});
    }
  });
  wc.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;
    const q = new URLSearchParams({ code: String(code), desc, url });
    wc.loadURL(`${SCHEME}://error/?${q}`).catch(() => {});
  });
  wc.on('render-process-gone', (e, d) => {
    t.crashed = true; t.loading = false;
    if (d.reason !== 'clean-exit') toast('Tab crashed — reload to continue');
    refresh();
  });
  wc.on('audio-state-changed', (e) => { t.audible = e.audible; refresh(); });
  wc.on('media-started-playing', () => { t.hasMedia = true; refresh(); });
  wc.on('enter-html-full-screen', () => { htmlFullscreen = true; win.setFullScreen(true); layout(); pushState(); });
  wc.on('leave-html-full-screen', () => { htmlFullscreen = false; if (win) win.setFullScreen(false); layout(); pushState(); });
  wc.on('found-in-page', (e, r) => {
    findState = { text: findState.text, active: r.activeMatchOrdinal, matches: r.matches };
    if (ui && !ui.webContents.isDestroyed()) ui.webContents.send('find-result', findState);
  });
  wc.on('before-input-event', (e, input) => { if (handleShortcut(input)) e.preventDefault(); });
  wc.on('focus', () => {
    if (overlayOpen && !editMode) setOverlay(false);
    if (activePanel && settings.sidebarMode === 'overlay') { activePanel = null; layout(); pushState(); }
  });
  wc.on('context-menu', (e, p) => showPageContextMenu(t, wc, p));
  wc.on('will-navigate', (e, url) => {
    if (/^(javascript|vbscript):/i.test(url)) e.preventDefault();
  });
  wc.setWindowOpenHandler((d) => {
    const url = d.url;
    if (/^https?:|^opentab:/i.test(url)) {
      const isPopup = d.disposition === 'new-window' && d.features && /width|height|popup/i.test(d.features);
      if (isPopup) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: appIcon(), backgroundColor: '#ffffff' },
        };
      }
      createTab({ url, private: t.private, openerId: t.id, activate: d.disposition !== 'background-tab', workspaceId: t.workspaceId, groupId: t.groupId });
    } else if (/^(mailto|tel):/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

function createTab(opts = {}) {
  const t = newTabObject(opts);
  if (opts.url) t.url = normalizeInput(opts.url);
  if (isInternal(t.url) && t.url.includes('newtab')) t.title = 'New Tab';
  else t.title = opts.title || hostOf(t.url) || 'Loading…';
  // insert after opener / active tab for natural ordering
  let idx = tabs.length;
  const anchor = opts.openerId ? tabById.get(opts.openerId) : (opts.activate !== false ? activeTab() : null);
  if (anchor && anchor.workspaceId === t.workspaceId && !t.pinned) {
    let at = tabs.indexOf(anchor) + 1;
    while (at < tabs.length && tabs[at].workspaceId === t.workspaceId && tabs[at].openerId === (anchor.id) && tabs[at] !== anchor) at++;
    idx = at;
  }
  if (t.groupId == null && anchor && anchor.groupId && opts.openerId) t.groupId = anchor.groupId;
  tabs.splice(idx, 0, t);
  tabById.set(t.id, t);
  if (opts.lazy) { t.sleeping = true; }
  else if (opts.activate === false) ensureView(t);
  if (opts.activate !== false) activateTab(t.id);
  else pushState();
  saveSession();
  return t;
}

function activateTab(id) {
  const t = tabById.get(id);
  if (!t) return;
  if (t.workspaceId !== activeWorkspaceId) {
    activeWorkspaceId = t.workspaceId;
  }
  const ws = wsActive();
  ws.activeTabId = id;
  t.lastActive = Date.now();
  if (t.groupId) { const g = groups.find((x) => x.id === t.groupId); if (g) g.collapsed = false; }
  ensureView(t);
  layout();
  if (!overlayOpen && !isInternal(t.url) || (isInternal(t.url) && !t.url.includes('newtab'))) t.view.webContents.focus();
  if (isInternal(t.url) && t.url.includes('newtab')) {
    // focus the omnibox for new tabs
    ui.webContents.focus();
    ui.webContents.send('focus-omnibox');
  }
  pushState();
  saveSession();
}

function closeTab(id, { keepClosed = true } = {}) {
  const t = tabById.get(id);
  if (!t) return;
  const wsId = t.workspaceId;
  const visible = wsTabs(wsId);
  const pos = visible.indexOf(t);
  if (keepClosed && !isInternal(t.url) && !t.private) {
    closedStack.push({ url: t.url, title: t.title, pinned: t.pinned, workspaceId: wsId, groupId: t.groupId });
    if (closedStack.length > 25) closedStack.shift();
  }
  destroyView(t);
  tabs.splice(tabs.indexOf(t), 1);
  tabById.delete(id);
  // last private tab closed: wipe cookies, storage and cache from memory
  if (t.private && !tabs.some((x) => x.private)) { privateSession.clearStorageData().catch(() => {}); privateSession.clearCache().catch(() => {}); privateDecisions.clear(); downloads.forgetPrivate(); }
  // drop empty groups
  groups = groups.filter((g) => tabs.some((x) => x.groupId === g.id));
  const ws = workspaces.find((w) => w.id === wsId);
  if (ws && ws.activeTabId === id) {
    const rest = wsTabs(wsId);
    const next = rest[Math.min(pos, rest.length - 1)] || null;
    const opener = t.openerId ? tabById.get(t.openerId) : null;
    ws.activeTabId = null;
    if (opener && opener.workspaceId === wsId) activateTab(opener.id);
    else if (next) activateTab(next.id);
    else if (wsId === activeWorkspaceId) createTab({ workspaceId: wsId });
    else { pushState(); }
  } else { pushState(); }
  saveSession();
}

function destroyView(t) {
  if (t.view) {
    const wc = t.view.webContents;
    wcToTab.delete(wc.id);
    dropPermPrompts((p) => p.wcId === wc.id);
    try { win.contentView.removeChildView(t.view); } catch { /* ignore */ }
    try { if (!wc.isDestroyed()) wc.close(); } catch { /* ignore */ }
    t.view = null;
  }
}

function sleepTab(t) {
  if (!t.view || t.pinned) return;
  const wc = t.view.webContents;
  if (!wc.isDestroyed()) { t.url = wc.getURL() || t.url; t.title = wc.getTitle() || t.title; }
  destroyView(t);
  t.sleeping = true; t.audible = false; t.loading = false;
}

// Minimized/hidden to the tray: nothing is on screen, so there's no reason to keep
// rendering even the "active" tab. Pinned and audible tabs are left alone so
// notifications/audio keep working, matching the normal sleep behavior above.
function sleepAllBackgroundTabs() {
  for (const t of tabs) { if (t.audible) continue; sleepTab(t); }
  pushState();
}

function moveTab(id, beforeId) {
  const t = tabById.get(id);
  if (!t) return;
  const before = beforeId ? tabById.get(beforeId) : null;
  tabs.splice(tabs.indexOf(t), 1);
  if (before && before.workspaceId === t.workspaceId) {
    tabs.splice(tabs.indexOf(before), 0, t);
    t.pinned = before.pinned;
    t.groupId = before.groupId;
  } else {
    // to end of this workspace
    let last = -1;
    tabs.forEach((x, i) => { if (x.workspaceId === t.workspaceId) last = i; });
    tabs.splice(last + 1, 0, t);
    t.pinned = false; t.groupId = null;
  }
  groups = groups.filter((g) => tabs.some((x) => x.groupId === g.id));
  pushState(); saveSession();
}

function reopenClosed() {
  const c = closedStack.pop();
  if (!c) return toast('No recently closed tabs');
  createTab({ url: c.url, title: c.title, pinned: c.pinned, workspaceId: workspaces.some((w) => w.id === c.workspaceId) ? c.workspaceId : activeWorkspaceId });
}

function cycleTab(dir) {
  const list = wsTabs(activeWorkspaceId);
  const at = activeTab();
  if (!list.length || !at) return;
  const i = list.indexOf(at);
  activateTab(list[(i + dir + list.length) % list.length].id);
}

let lastSearchCheck = 0;
function searchDisableCheck() {
  // a quick disabled-check whenever the user searches, so a disable from the
  // admin panel takes effect right away instead of at the next 30-min check-in
  const t = Date.now();
  if (t - lastSearchCheck < 8000) return;
  lastSearchCheck = t;
  checkin();
}

function navigateActive(text) {
  searchDisableCheck();
  const at = activeTab();
  const url = normalizeInput(text);
  if (!at) return createTab({ url });
  at.url = url;
  at.title = isInternal(url) ? 'New Tab' : hostOf(url) || at.title;
  if (!at.view) ensureView(at);
  else at.view.webContents.loadURL(url).catch(() => {});
  at.view.webContents.focus();
  pushState();
}

// ───────────────────────────────────────────────────────────── groups & workspaces
const GROUP_COLORS = ['#f2f2f2', '#d6d6d6', '#bdbdbd', '#a3a3a3', '#8a8a8a', '#e6e6e6', '#c9c9c9', '#b0b0b0'];
const GROUP_COLOR_NAMES = ['White', 'Silver', 'Ash', 'Grey', 'Steel', 'Mist', 'Cloud', 'Stone'];
// older versions used bright colors; map anything that isn't a grey onto the palette
const toGrey = (c, i) => (GROUP_COLORS.includes(c) ? c : GROUP_COLORS[i % GROUP_COLORS.length]);

function createGroup(tabIds, name = '') {
  const list = tabIds.map((i) => tabById.get(i)).filter(Boolean);
  if (!list.length) return null;
  const g = { id: uid('g'), name, color: GROUP_COLORS[groups.length % GROUP_COLORS.length], collapsed: false, workspaceId: list[0].workspaceId };
  groups.push(g);
  list.forEach((t) => { t.groupId = g.id; t.pinned = false; });
  gatherGroup(g.id);
  pushState(); saveSession();
  return g;
}

function gatherGroup(gid) {
  const members = tabs.filter((t) => t.groupId === gid);
  if (members.length < 2) return;
  const first = tabs.indexOf(members[0]);
  members.forEach((m) => tabs.splice(tabs.indexOf(m), 1));
  tabs.splice(first, 0, ...members);
}

function addToGroup(tabId, gid) {
  const t = tabById.get(tabId); const g = groups.find((x) => x.id === gid);
  if (!t || !g || t.workspaceId !== g.workspaceId) return;
  t.groupId = gid; t.pinned = false;
  const lastMember = tabs.filter((x) => x.groupId === gid && x !== t).pop();
  if (lastMember) { tabs.splice(tabs.indexOf(t), 1); tabs.splice(tabs.indexOf(lastMember) + 1, 0, t); }
  groups = groups.filter((x) => tabs.some((y) => y.groupId === x.id));
  pushState(); saveSession();
}

function removeFromGroup(tabId) {
  const t = tabById.get(tabId);
  if (!t) return;
  t.groupId = null;
  groups = groups.filter((x) => tabs.some((y) => y.groupId === x.id));
  pushState(); saveSession();
}

function createWorkspace({ name, emoji, color }) {
  const w = { id: uid('w'), name: (name || 'Workspace').slice(0, 24), emoji: emoji || '', color: color || GROUP_COLORS[workspaces.length % GROUP_COLORS.length], activeTabId: null };
  workspaces.push(w);
  switchWorkspace(w.id);
  return w;
}

function switchWorkspace(id) {
  const w = workspaces.find((x) => x.id === id);
  if (!w) return;
  activeWorkspaceId = id;
  let t = tabById.get(w.activeTabId);
  if (!t || t.workspaceId !== id) t = wsTabs(id)[0];
  if (t) activateTab(t.id);
  else createTab({ workspaceId: id });
}

function deleteWorkspace(id) {
  if (workspaces.length < 2) return toast('You need at least one workspace');
  const idx = workspaces.findIndex((w) => w.id === id);
  if (idx < 0) return;
  wsTabs(id).forEach((t) => { destroyView(t); tabById.delete(t.id); tabs.splice(tabs.indexOf(t), 1); });
  groups = groups.filter((g) => g.workspaceId !== id);
  workspaces.splice(idx, 1);
  if (activeWorkspaceId === id) switchWorkspace(workspaces[Math.max(0, idx - 1)].id);
  else pushState();
  saveSession();
}

function moveTabToWorkspace(tabId, wid) {
  const t = tabById.get(tabId); const w = workspaces.find((x) => x.id === wid);
  if (!t || !w || t.workspaceId === wid) return;
  const wasActive = wsActive().activeTabId === tabId;
  t.workspaceId = wid; t.groupId = null;
  groups = groups.filter((g) => tabs.some((x) => x.groupId === g.id));
  if (wasActive) {
    const rest = wsTabs(activeWorkspaceId);
    wsActive().activeTabId = null;
    if (rest.length) activateTab(rest[0].id); else createTab({});
  } else pushState();
  toast(`Moved to ${w.name}`);
  saveSession();
}

// ───────────────────────────────────────────────────────────── native context menus
function tabMenu(id) {
  const t = tabById.get(id);
  if (!t) return;
  const wsList = workspaces.filter((w) => w.id !== t.workspaceId);
  const grpList = groups.filter((g) => g.workspaceId === t.workspaceId && g.id !== t.groupId);
  const tpl = [
    { label: t.pinned ? 'Unpin tab' : 'Pin tab', click: () => cmd.pinTab({ id: t.id, pinned: !t.pinned }) },
    { label: t.muted ? 'Unmute tab' : 'Mute tab', click: () => { t.muted = !t.muted; if (t.view) t.view.webContents.setAudioMuted(t.muted); pushState(); } },
    { label: 'Duplicate tab', click: () => createTab({ url: t.url, workspaceId: t.workspaceId, openerId: t.id }) },
    { label: 'Reload tab', click: () => reloadTab(t) },
    { type: 'separator' },
    {
      label: 'Add to group',
      submenu: [
        { label: 'New group', click: () => createGroup([t.id]) },
        ...(grpList.length ? [{ type: 'separator' }] : []),
        ...grpList.map((g) => ({ label: g.name || 'Unnamed group', click: () => addToGroup(t.id, g.id) })),
      ],
    },
    ...(t.groupId ? [{ label: 'Remove from group', click: () => removeFromGroup(t.id) }] : []),
    ...(wsList.length ? [{ label: 'Move to workspace', submenu: wsList.map((w) => ({ label: `${w.emoji ? w.emoji + ' ' : ''}${w.name}`, click: () => moveTabToWorkspace(t.id, w.id) })) }] : []),
    { type: 'separator' },
    { label: 'Close tab', click: () => closeTab(t.id) },
    { label: 'Close other tabs', click: () => wsTabs(t.workspaceId).filter((x) => x !== t && !x.pinned).forEach((x) => closeTab(x.id)) },
    { label: 'Close tabs to the right', click: () => { const l = wsTabs(t.workspaceId); l.slice(l.indexOf(t) + 1).filter((x) => !x.pinned).forEach((x) => closeTab(x.id)); } },
  ];
  Menu.buildFromTemplate(tpl).popup({ window: win });
}

function reloadTab(t) { if (t.view) t.view.webContents.reload(); else ensureView(t); }

// download a URL, asking where to save it
function saveAs(wc, url) {
  if (!/^(https?|blob|data):/i.test(url || '')) return;
  downloads.saveAs(url);
  wc.downloadURL(url);
}

function groupMenu(gid) {
  const g = groups.find((x) => x.id === gid);
  if (!g) return;
  const tpl = [
    { label: g.collapsed ? 'Expand group' : 'Collapse group', click: () => { g.collapsed = !g.collapsed; pushState(); saveSession(); } },
    { label: 'Rename…', click: () => ui.webContents.send('prompt-rename-group', { id: gid }) },
    { label: 'Ungroup', click: () => { tabs.filter((t) => t.groupId === gid).forEach((t) => { t.groupId = null; }); groups = groups.filter((x) => x.id !== gid); pushState(); saveSession(); } },
    { label: 'Close group', click: () => tabs.filter((t) => t.groupId === gid).forEach((t) => closeTab(t.id)) },
    { type: 'separator' },
    { label: 'Color', submenu: GROUP_COLORS.map((c, i) => ({ label: GROUP_COLOR_NAMES[i], type: 'radio', checked: g.color === c, click: () => { g.color = c; pushState(); saveSession(); } })) },
  ];
  Menu.buildFromTemplate(tpl).popup({ window: win });
}

function workspaceMenu(id) {
  const w = workspaces.find((x) => x.id === id);
  if (!w) return;
  Menu.buildFromTemplate([
    { label: 'Rename…', click: () => ui.webContents.send('prompt-rename-workspace', { id: w.id, name: w.name }) },
    { label: 'Delete workspace', enabled: workspaces.length > 1, click: () => deleteWorkspace(id) },
  ]).popup({ window: win });
}

function showPageContextMenu(t, wc, p) {
  const items = [];
  if (p.linkURL) {
    items.push(
      { label: 'Open link in new tab', click: () => createTab({ url: p.linkURL, openerId: t.id, activate: false, workspaceId: t.workspaceId }) },
      { label: 'Copy link address', click: () => clipboard.writeText(p.linkURL) },
      { label: 'Save link as…', click: () => saveAs(wc, p.linkURL) },
      { type: 'separator' },
    );
  }
  if (p.mediaType === 'image' && p.srcURL) {
    items.push(
      { label: 'Open image in new tab', click: () => createTab({ url: p.srcURL, openerId: t.id, workspaceId: t.workspaceId }) },
      { label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) },
      { label: 'Save image as…', click: () => saveAs(wc, p.srcURL) },
      { type: 'separator' },
    );
  }
  if (p.mediaType === 'video' || p.mediaType === 'audio') {
    items.push({ label: 'Pop out video', click: () => togglePip(), visible: p.mediaType === 'video' }, { type: 'separator' });
  }
  if (p.isEditable) {
    items.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' });
  } else if (p.selectionText) {
    const s = p.selectionText.trim();
    items.push(
      { role: 'copy' },
      { label: `Search for “${s.length > 28 ? s.slice(0, 28) + '…' : s}”`, click: () => createTab({ url: SEARCH_ENGINES[settings.searchEngine].url.replace('%s', encodeURIComponent(s)), openerId: t.id, workspaceId: t.workspaceId }) },
      { type: 'separator' },
    );
  }
  items.push(
    { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
    { label: 'Reload', click: () => wc.reload() },
    { type: 'separator' },
    { label: 'Bookmark this page', click: () => toggleBookmark() },
    { label: 'Open page in default browser', click: () => { const u = wc.getURL(); if (/^https?:/i.test(u)) shell.openExternal(u); } },
    { label: 'Inspect', click: () => wc.inspectElement(p.x, p.y) },
  );
  Menu.buildFromTemplate(items).popup({ window: win });
}

// ───────────────────────────────────────────────────────────── shortcuts
function handleShortcut(input) {
  if (input.type !== 'keyDown') return false;
  const ctrl = input.control || input.meta;
  const k = (input.key || '').toLowerCase();
  const send = (ch, ...a) => ui && !ui.webContents.isDestroyed() && ui.webContents.send(ch, ...a);
  const at = activeTab();
  const awc = at?.view && !at.view.webContents.isDestroyed() ? at.view.webContents : null;
  const findStep = (forward) => { if (findState.text) cmd.find({ text: findState.text, next: true, forward }); else { setOverlay(true); send('open-find'); } };
  if (ctrl && !input.shift && !input.alt) {
    if (k === 't' || k === 'n') { createTab({}); return true; }
    if (k === 'f4') { if (at) closeTab(at.id); return true; }
    if (k === 'e') { ui.webContents.focus(); send('focus-omnibox'); return true; }
    if (k === 'g') { findStep(true); return true; }
    if (k === 'm') { if (at) { at.muted = !at.muted; awc?.setAudioMuted(at.muted); pushState(); } return true; }
    if (k === 's') { if (awc && !isInternal(at.url)) saveAs(awc, awc.getURL()); return true; }
    if (k === 'j') { setOverlay(true); send('open-panel', 'downloads'); return true; }
    if (k === 'f5') { cmd.hardReload(); return true; }
    if (k === '/') { setOverlay(true); send('open-panel', 'keys'); return true; }
    if (k === 'w') { const a = activeTab(); if (a) closeTab(a.id); return true; }
    if (k === 'l' || k === 'k') { ui.webContents.focus(); send('focus-omnibox'); return true; }
    if (k === 'r') { cmd.reload(); return true; }
    if (k === 'd') { toggleBookmark(); return true; }
    if (k === 'f') { setOverlay(true); send('open-find'); return true; }
    if (k === 'h') { setOverlay(true); send('open-panel', 'library:history'); return true; }
    if (k === ',') { setOverlay(true); send('open-panel', 'menu'); return true; }
    if (k === 'p') { activeTab()?.view?.webContents.print(); return true; }
    if (k === 'tab') { cycleTab(1); return true; }
    if (k === 'pagedown') { cycleTab(1); return true; }
    if (k === 'pageup') { cycleTab(-1); return true; }
    if (/^[1-9]$/.test(k)) {
      const list = wsTabs(activeWorkspaceId);
      const n = k === '9' ? list.length - 1 : parseInt(k, 10) - 1;
      if (list[n]) activateTab(list[n].id);
      return true;
    }
    if (k === '=' || k === '+') { zoom(0.5); return true; }
    if (k === '-' || k === '_') { zoom(-0.5); return true; }
    if (k === '0') { zoom(0); return true; }
  }
  if (ctrl && input.shift && !input.alt) {
    if (k === 't') { reopenClosed(); return true; }
    if (k === 'n') { createTab({ private: true }); return true; }
    if (k === 's') { setSetting('sidebar', sidebarOn() ? 'off' : 'left'); return true; }
    if (k === 'e') { setEditMode(!editMode); return true; }
    if (k === 'd') { if (at && !isInternal(at.url)) createTab({ url: at.url, private: at.private, openerId: at.id }); return true; }
    if (k === 'p') { if (at) cmd.pinTab({ id: at.id, pinned: !at.pinned }); return true; }
    if (k === 'x') { if (at) wsTabs(activeWorkspaceId).filter((x) => x !== at && !x.pinned).forEach((x) => closeTab(x.id)); return true; }
    if (k === 'g') { findStep(false); return true; }
    if (k === 'c') { if (at && !isInternal(at.url)) { clipboard.writeText(at.url); toast('Link copied'); } return true; }
    if (k === 'b') { setSetting('bookmarksBar', !settings.bookmarksBar); return true; }
    if (k === 'l') { const names = Object.keys(THEMES); setSetting('theme', names[(names.indexOf(settings.theme) + 1) % names.length]); toast('Theme: ' + settings.theme); return true; }
    if (k === 'v') { setSetting('tabPosition', settings.tabPosition === 'top' ? 'left' : 'top'); return true; }
    if (k === 'q') { cmd.quit(); return true; }
    if (k === 'pageup' || k === 'pagedown') {
      const list = wsTabs(activeWorkspaceId); const i = list.indexOf(at);
      if (k === 'pageup' && i > 0) moveTab(at.id, list[i - 1].id);
      if (k === 'pagedown' && i >= 0 && i < list.length - 1) moveTab(at.id, list[i + 2]?.id || null);
      return true;
    }
    if (k === 'tab') { cycleTab(-1); return true; }
    if (k === 'o') { setOverlay(true); send('open-panel', 'library:bookmarks'); return true; }
    if (k === 'i') { cmd.devtools(); return true; }
    if (k === 'r') { activeTab()?.view?.webContents.reloadIgnoringCache(); return true; }
    if (k === 'delete') { setOverlay(true); send('open-panel', 'menu'); return true; }
  }
  if (input.alt && !ctrl && !input.shift) {
    if (k === 'arrowleft') { cmd.back(); return true; }
    if (k === 'arrowright') { cmd.forward(); return true; }
    if (k === 'p') { togglePip(); return true; }
    if (k === 'd') { ui.webContents.focus(); send('focus-omnibox'); return true; }
    if (k === 'home') { cmd.home(); return true; }
    if (/^[1-9]$/.test(k)) { const it = settings.sidebarItems[+k - 1]; if (it) toggleSidePanel(it.id); return true; }
  }
  if (!ctrl && !input.alt) {
    if (k === 'f5') { cmd.reload(); return true; }
    if (k === 'f3') { findStep(!input.shift); return true; }
    if (k === 'escape' && !overlayOpen && at?.loading) { awc?.stop(); return true; }
    if (k === 'f6') { ui.webContents.focus(); send('focus-omnibox'); return true; }
    if (k === 'f12') { cmd.devtools(); return true; }
    if (k === 'f11') { win.setFullScreen(!win.isFullScreen()); return true; }
    if (k === 'escape' && editMode) { setEditMode(false); return true; }
    if (k === 'escape' && overlayOpen) { setOverlay(false); return true; }
    if (k === 'escape' && activePanel) { activePanel = null; layout(); pushState(); return true; }
  }
  return false;
}

function zoom(delta) {
  const wc = activeTab()?.view?.webContents;
  if (!wc) return;
  wc.setZoomLevel(delta === 0 ? 0 : Math.max(-4, Math.min(5, wc.getZoomLevel() + delta)));
}

// ───────────────────────────────────────────────────────────── picture-in-picture
const PIP_CODE = `(() => {
  try {
    if (document.pictureInPictureElement) { document.exitPictureInPicture(); return 'exited'; }
    const vids = [...document.querySelectorAll('video')].filter(v => v.readyState > 0 && v.videoWidth > 0 && !v.ended);
    if (!vids.length) return 'none';
    const score = v => (v.paused ? 0 : 1e9) + v.videoWidth * v.videoHeight;
    vids.sort((a, b) => score(b) - score(a));
    const v = vids[0];
    v.disablePictureInPicture = false;
    v.removeAttribute('disablePictureInPicture');
    return v.requestPictureInPicture().then(() => 'entered').catch(e => 'err:' + e.message);
  } catch (e) { return 'err:' + e.message; }
})()`;

async function togglePip() {
  const wc = activeTab()?.view?.webContents;
  if (!wc) return;
  let result = 'none';
  for (const frame of wc.mainFrame.framesInSubtree) {
    try {
      const r = await frame.executeJavaScript(PIP_CODE, true);
      if (r === 'entered' || r === 'exited') { result = r; break; }
      if (typeof r === 'string' && r.startsWith('err:')) result = r;
    } catch { /* frame gone */ }
  }
  if (result === 'none') toast('No video found on this page');
  else if (result.startsWith('err:')) toast('Could not pop out this video');
}

// ───────────────────────────────────────────────────────────── bookmarks & history
function toggleBookmark() {
  const at = activeTab();
  if (!at || isInternal(at.url)) return toast('Open a web page first');
  const list = bookmarksStore.data;
  const i = list.findIndex((b) => b.url === at.url);
  if (i >= 0) { list.splice(i, 1); toast('Bookmark removed'); }
  else { list.push({ id: uid('b'), title: at.title || at.url, url: at.url, folder: '', added: Date.now() }); toast('Bookmarked'); }
  bookmarksStore.save(); sendBookmarks(); pushState();
}

function recordHistory(url, title) {
  if (!/^https?:/i.test(url)) return;
  const h = historyStore.data;
  const i = h.findIndex((x) => x.url === url);
  if (i >= 0) { const e = h.splice(i, 1)[0]; e.t = Date.now(); e.visits = (e.visits || 1) + 1; if (title) e.title = title; h.unshift(e); }
  else h.unshift({ url, title: title || url, t: Date.now(), visits: 1 });
  if (h.length > 3000) h.length = 3000;
  historyStore.save();
}

function suggest(text) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return [];
  const out = []; const seen = new Set();
  const add = (kind, title, url) => { if (!seen.has(url) && out.length < 8) { seen.add(url); out.push({ kind, title, url }); } };
  for (const b of bookmarksStore.data) if ((b.title + ' ' + b.url).toLowerCase().includes(q)) add('bookmark', b.title, b.url);
  for (const h of historyStore.data) { if (out.length >= 8) break; if ((h.title + ' ' + h.url).toLowerCase().includes(q)) add('history', h.title, h.url); }
  return out;
}

// ───────────────────────────────────────────────────────────── bookmark sync / import / export
function userDataRoots() {
  const local = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
  const roaming = process.env.APPDATA || path.join(app.getPath('home'), 'AppData', 'Roaming');
  const home = app.getPath('home');
  if (process.platform === 'win32') {
    return {
      chrome: [path.join(local, 'Google', 'Chrome', 'User Data')],
      edge: [path.join(local, 'Microsoft', 'Edge', 'User Data')],
      brave: [path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
      opera: [path.join(roaming, 'Opera Software', 'Opera Stable'), path.join(roaming, 'Opera Software', 'Opera GX Stable')],
    };
  }
  if (process.platform === 'darwin') {
    const s = path.join(home, 'Library', 'Application Support');
    return {
      chrome: [path.join(s, 'Google', 'Chrome')], edge: [path.join(s, 'Microsoft Edge')],
      brave: [path.join(s, 'BraveSoftware', 'Brave-Browser')], opera: [path.join(s, 'com.operasoftware.Opera')],
    };
  }
  const c = path.join(home, '.config');
  return {
    chrome: [path.join(c, 'google-chrome')], edge: [path.join(c, 'microsoft-edge')],
    brave: [path.join(c, 'BraveSoftware', 'Brave-Browser')], opera: [path.join(c, 'opera')],
  };
}

function findBookmarkFiles(browser) {
  const files = [];
  for (const root of userDataRoots()[browser] || []) {
    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { /* not installed */ }
    const candidates = [root];
    for (const e of entries) if (e.isDirectory() && (e.name === 'Default' || /^Profile \d+$/.test(e.name))) candidates.push(path.join(root, e.name));
    for (const dir of candidates) {
      const f = path.join(dir, 'Bookmarks');
      if (fs.existsSync(f)) files.push({ file: f, profile: path.basename(dir) === path.basename(root) ? '' : path.basename(dir) });
    }
  }
  return files;
}

const BROWSER_LABEL = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave', opera: 'Opera' };
const { parseChromiumBookmarks, parseHTMLBookmarks } = bookmarkFiles;

function syncFromBrowsers(manual) {
  let added = 0; let removed = 0; let found = 0;
  const list = bookmarksStore.data;
  for (const b of settings.syncSources) {
    const label = BROWSER_LABEL[b] || b;
    for (const { file, profile } of findBookmarkFiles(b)) {
      let json; try { json = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
      found++;
      const src = `${b}:${profile || 'Default'}`;
      const incoming = parseChromiumBookmarks(json, profile && profile !== 'Default' ? `${label} (${profile})` : label);
      const keyOf = (x) => `${x.folder}\u0000${x.url}`;
      const incomingKeys = new Set(incoming.map(keyOf));
      for (let i = list.length - 1; i >= 0; i--) if (list[i].src === src && !incomingKeys.has(keyOf(list[i]))) { list.splice(i, 1); removed++; }
      const have = new Set(list.filter((x) => x.src === src).map(keyOf));
      for (const x of incoming) if (!have.has(keyOf(x))) { list.push({ id: uid('b'), ...x, src, added: Date.now() }); added++; }
    }
  }
  settings.lastSync = Date.now();
  settingsStore.save(); bookmarksStore.save(); sendBookmarks(); pushState();
  if (manual) toast(found ? `Synced · ${added} added, ${removed} removed` : 'No browsers found to sync');
  return { found, added, removed };
}

let syncTimer = null;
function scheduleAutoSync() {
  clearInterval(syncTimer); syncTimer = null;
  if (settings.autoSync) { syncFromBrowsers(false); syncTimer = setInterval(() => syncFromBrowsers(false), 10 * 60 * 1000); }
}

async function importHTMLFile() {
  const r = await dialog.showOpenDialog(win, { title: 'Import bookmarks', filters: [{ name: 'Bookmarks HTML', extensions: ['html', 'htm'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return;
  const items = parseHTMLBookmarks(fs.readFileSync(r.filePaths[0], 'utf8'));
  const have = new Set(bookmarksStore.data.map((b) => b.folder + '\u0000' + b.url));
  let n = 0;
  for (const x of items) {
    const folder = x.folder ? `Imported/${x.folder}` : 'Imported';
    if (!have.has(folder + '\u0000' + x.url)) { bookmarksStore.data.push({ id: uid('b'), ...x, folder, added: Date.now() }); n++; }
  }
  bookmarksStore.save(); sendBookmarks();
  toast(`Imported ${n} bookmarks`);
}

async function exportHTMLFile() {
  const r = await dialog.showSaveDialog(win, { title: 'Export bookmarks', defaultPath: path.join(app.getPath('documents'), 'opentab-bookmarks.html'), filters: [{ name: 'Bookmarks HTML', extensions: ['html'] }] });
  if (r.canceled || !r.filePath) return;
  fs.writeFileSync(r.filePath, bookmarkFiles.exportHTML(bookmarksStore.data), 'utf8');
  toast('Bookmarks exported');
  shell.showItemInFolder(r.filePath);
}

// ───────────────────────────────────────────────────────────── session persistence
function saveSession() {
  if (!sessionStore) return;
  sessionStore.data = {
    activeWorkspaceId,
    workspaces: workspaces.map((w) => ({ ...w })),
    groups: groups.map((g) => ({ ...g })),
    tabs: tabs.filter((t) => !t.private).map((t) => ({
      id: t.id, url: t.view && !t.view.webContents.isDestroyed() ? (t.view.webContents.getURL() || t.url) : t.url,
      title: t.title, favicon: t.favicon, pinned: t.pinned, groupId: t.groupId, workspaceId: t.workspaceId,
    })),
  };
  sessionStore.save();
}

function restoreSession() {
  const s = sessionStore.data;
  if (s && Array.isArray(s.workspaces) && s.workspaces.length) {
    workspaces = s.workspaces;
    groups = s.groups || [];
    activeWorkspaceId = workspaces.some((w) => w.id === s.activeWorkspaceId) ? s.activeWorkspaceId : workspaces[0].id;
    for (const st of s.tabs || []) {
      if (!workspaces.some((w) => w.id === st.workspaceId)) continue;
      const t = newTabObject({ ...st });
      t.id = st.id; t.url = st.url || 'opentab://newtab'; t.title = st.title || 'Tab'; t.favicon = st.favicon || '';
      tabs.push(t); tabById.set(t.id, t);
    }
    groups = groups.filter((g) => tabs.some((t) => t.groupId === g.id));
  }
  if (!workspaces.length) {
    workspaces = [{ id: uid('w'), name: 'Home', emoji: '', color: GROUP_COLORS[2], activeTabId: null }];
    activeWorkspaceId = workspaces[0].id;
  }
  // pinned tabs stay loaded so notifications keep flowing
  for (const t of tabs) if (t.pinned && !isInternal(t.url)) ensureView(t);
  const w = wsActive();
  let t = tabById.get(w.activeTabId);
  if (!t || t.workspaceId !== w.id) t = wsTabs(w.id)[0];
  if (t) activateTab(t.id); else createTab({});
}

// ───────────────────────────────────────────────────────────── window, tray
function appIcon() {
  const p = path.join(__dirname, 'build', 'icon.png');
  return nativeImage.createFromPath(p);
}

function createWindow() {
  const t = THEMES[settings.theme] || THEMES.ink;
  const b = settings.bounds || { width: 1360, height: 860 };
  win = new BaseWindow({
    ...b, minWidth: 720, minHeight: 480, show: false, title: APP_NAME, icon: appIcon(),
    backgroundColor: t.bg,
    // frameless: the UI draws its own drag area and window buttons
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
  });
  if (settings.maximized) win.maximize();

  ui = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  ui.setBackgroundColor('#00000000');
  win.contentView.addChildView(ui);
  ui.webContents.loadFile(path.join(__dirname, 'ui', 'index.html'));
  ui.webContents.on('before-input-event', (e, input) => { if (handleShortcut(input)) e.preventDefault(); });
  ui.webContents.on('context-menu', (e, p) => {
    if (p.isEditable) Menu.buildFromTemplate([{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }]).popup({ window: win });
  });

  side = makeChromeView('sidebar.html');
  dockMedia = makeChromeView('dock.html');
  restack();
  if (!spotify) initSpotify();
  if (settings.mediaDock) startMedia();

  win.on('resize', layout);
  win.on('maximize', () => { layout(); pushState(); });
  win.on('unmaximize', () => { layout(); pushState(); });
  win.on('enter-full-screen', layout);
  win.on('leave-full-screen', () => { htmlFullscreen = false; layout(); pushState(); });
  win.on('close', (e) => {
    if (!win.isMaximized() && !win.isFullScreen()) settings.bounds = win.getBounds();
    settings.maximized = win.isMaximized();
    settingsStore.save();
    saveSession();
    if (!quitting && settings.runInBackground && tray) {
      e.preventDefault();
      win.hide();
      sleepAllBackgroundTabs();
      if (!settings.__trayHinted) {
        settings.__trayHinted = true;
        new Notification({ title: 'opentab is still running', body: 'Right-click the tray icon to quit.', icon: appIcon() }).show();
      }
    }
  });
  win.on('closed', () => { win = null; ui = null; side = null; dockMedia = null; panels.clear(); stopMedia(); });

  ui.webContents.once('did-finish-load', () => {
    restoreSession();
    if (!settings.workspaces) for (const t of tabs) t.workspaceId = activeWorkspaceId;
    workspaces.forEach((w, i) => { w.color = toGrey(w.color, i + 2); });
    groups.forEach((g, i) => { g.color = toGrey(g.color, i); });
    sendBookmarks();
    layout();
    win.show();
    // first launch after an update (the menu also gets a "What's new" item)
    if (whatsNew) setTimeout(() => toast(`Updated to opentab ${whatsNew.version}. See what’s new in the menu.`), 1500);
  });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  const at = activeTab();
  if (at && at.sleeping) { ensureView(at); layout(); pushState(); }
}

function updateTray() {
  if (settings.runInBackground && !tray) {
    try {
      tray = new Tray(appIcon().resize({ width: 32, height: 32 }));
      tray.setToolTip('opentab');
      tray.on('click', showWindow);
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open opentab', click: showWindow },
        { label: 'New tab', click: () => { showWindow(); createTab({}); } },
        { type: 'separator' },
        { label: 'Quit opentab', click: () => { quitting = true; app.quit(); } },
      ]));
    } catch { tray = null; }
  } else if (!settings.runInBackground && tray) { tray.destroy(); tray = null; }
}



// ───────────────────────────────────────────────────────────── telemetry + remote disable
// opentab reports in to the admin backend (per the Terms of Service): a 10-digit
// user id, app version, platform, OS version, architecture, locale and device
// name. The IP is read server-side. No browsing history, files or passwords are
// sent. Staff can disable a copy from the admin panel; when disabled, this app
// shows a support screen instead of browsing (the window still closes normally).
const os = require('os');
const ADMIN_ORIGIN = 'https://www.opentab.cc';
const CHECKIN_MS = 30 * 60 * 1000;
let locked = false;
let lockedMessage = '';
let currentNotice = '';
let supportEmail = 'support@opentab.cc';
let lockView = null;

function ensureUserId() {
  if (!/^\d{10}$/.test(settings.userId || '')) {
    settings.userId = String(Math.floor(1e9 + Math.random() * 9e9));
    settingsStore.save();
  }
  return settings.userId;
}

function telemetryPayload() {
  let screenSize = '';
  try { const s = screen.getPrimaryDisplay().size; screenSize = s.width + 'x' + s.height; } catch { /* ignore */ }
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }
  return {
    uid: ensureUserId(),
    appVersion: app.getVersion(),
    platform: process.platform,
    osVersion: os.release(),
    arch: process.arch,
    locale: app.getLocale(),
    // Only a one-way hash of the computer name leaves the device (it often contains the user's name).
    device: 'h:' + require('crypto').createHash('sha256').update(os.hostname()).digest('hex').slice(0, 12),
    tz,
    screen: screenSize,
    ram: Math.round(os.totalmem() / 1073741824),
    cpu: (os.cpus() || []).length,
    portable: !!process.env.PORTABLE_EXECUTABLE_DIR,
  };
}

async function checkin() {
  // Dev runs and the portable build don't report in.
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  try {
    const res = await net.fetch(ADMIN_ORIGIN + '/api/checkin', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(telemetryPayload()),
    });
    if (!res.ok) return;
    const d = await res.json();
    supportEmail = d.support || supportEmail;
    setLocked(!!d.disabled, d.message || '');
    if ((d.notice || '') !== currentNotice) { currentNotice = d.notice || ''; pushState(); }
  } catch { /* offline or backend down: keep working (fail open) */ }
}

function setLocked(on, message) {
  lockedMessage = message || '';
  if (on === locked) { if (on && lockView) pushLockInfo(); return; }
  locked = on;
  if (on) {
    for (const t of tabs) if (t.view) t.view.setVisible(false);
    lockView = new WebContentsView({ webPreferences: { session: tabSession, preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } });
    win.contentView.addChildView(lockView);
    lockView.webContents.loadFile(path.join(__dirname, 'pages', 'locked.html'));
    lockView.webContents.once('did-finish-load', pushLockInfo);
    lockView.webContents.on('before-input-event', (e, input) => {
      const k = (input.key || '').toLowerCase();
      // keep only: close the window and quit
      if (input.type === 'keyDown' && !((input.control || input.meta) && (k === 'w' || k === 'q')) && !(input.alt && input.key === 'F4')) return;
    });
  } else if (lockView) {
    try { win.contentView.removeChildView(lockView); } catch { /* ignore */ }
    if (!lockView.webContents.isDestroyed()) lockView.webContents.close();
    lockView = null;
  }
  layout();
}

function pushLockInfo() {
  if (lockView && !lockView.webContents.isDestroyed()) {
    lockView.webContents.send('lock', { message: lockedMessage, support: supportEmail, uid: ensureUserId(), theme: settings.theme, custom: THEMES.custom, corners: settings.corners, font: settings.font });
  }
}

// ───────────────────────────────────────────────────────────── sidebar, panels and corner controls
const SIDE_W = 52;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
let side = null;            // icon strip
let dockMedia = null;       // music player card (bottom-right)
const panels = new Map();   // item id -> view, kept alive so logins and calls stay connected
const panelBadges = {};
let activePanel = null;     // open sidebar panel
let editMode = false;
let media = { ok: false };
let mediaProc = null;

const sidebarOn = () => settings.sidebar !== 'off';

// keep chrome views above pages, and the main UI above everything
function restack() {
  if (!win) return;
  for (const v of [side, ...panels.values(), dockMedia, ui]) if (v && !v.webContents.isDestroyed()) win.contentView.addChildView(v);
}

function makeChromeView(file, search) {
  const v = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } });
  v.setBackgroundColor('#00000000');
  win.contentView.addChildView(v);
  v.webContents.loadFile(path.join(__dirname, 'ui', file), search ? { search } : undefined);
  v.webContents.on('before-input-event', (e, input) => { if (handleShortcut(input)) e.preventDefault(); });
  return v;
}

function panelItem(id) {
  return settings.sidebarItems.find((x) => x.id === id);
}

function panelView(item) {
  let v = panels.get(item.id);
  if (v && !v.webContents.isDestroyed()) return v;
  v = new WebContentsView({ webPreferences: { session: tabSession, preload: path.join(__dirname, 'page-preload.js'), contextIsolation: true, sandbox: true } });
  if (v.setBorderRadius) v.setBorderRadius(12);
  panels.set(item.id, v);
  const wc = v.webContents;
  wc.setUserAgent(item.mobile ? MOBILE_UA : CHROME_UA());
  wc.setWindowOpenHandler((d) => { if (/^https?:/i.test(d.url)) createTab({ url: d.url }); return { action: 'deny' }; });
  wc.on('page-title-updated', (e, title) => { const m = /^\((\d{1,3})\+?\)/.exec(title || ''); panelBadges[item.id] = m ? +m[1] : 0; pushState(); });
  wc.on('page-favicon-updated', (e, favs) => {
    const it = settings.sidebarItems.find((x) => x.id === item.id);
    if (it && it.type === 'web' && favs[0] && it.favicon !== favs[0]) { it.favicon = favs[0]; settingsStore.save(); pushState(); }
  });
  wc.on('before-input-event', (e, input) => { if (handleShortcut(input)) e.preventDefault(); });
  wc.loadURL(item.type === 'web' ? item.url : `${SCHEME}://panel/?name=${item.id}`).catch(() => {});
  restack();
  return v;
}

function dropPanel(id) {
  const v = panels.get(id);
  if (v) { try { win.contentView.removeChildView(v); } catch { /* ignore */ } if (!v.webContents.isDestroyed()) v.webContents.close(); }
  panels.delete(id);
  if (activePanel === id) activePanel = null;
}

function toggleSidePanel(id) {
  const item = panelItem(id);
  if (!item || activePanel === id) activePanel = null;
  else { activePanel = id; if (!sidebarOn()) settings.sidebar = 'left'; panelView(item).webContents.focus(); }
  layout(); pushState();
}

function addSidePanel(url) {
  const at = activeTab();
  url = url || (at && !isInternal(at.url) ? at.url : '');
  if (!/^https?:/i.test(url)) return toast('Open a website first, then add it');
  const id = uid('p');
  settings.sidebarItems.push({ id, type: 'web', url, title: (at && at.url === url ? at.title : '') || hostOf(url), favicon: at && at.url === url ? at.favicon : '' });
  settingsStore.save();
  toggleSidePanel(id);
}

function panelMenu(id) {
  const it = settings.sidebarItems.find((x) => x.id === id);
  if (!it) return;
  const v = panels.get(id);
  const items = [];
  if (it.type === 'web') {
    items.push(
      { label: 'Reload', enabled: !!v, click: () => v.webContents.reload() },
      { label: 'Open in a tab', click: () => createTab({ url: v && !v.webContents.isDestroyed() ? v.webContents.getURL() : it.url }) },
      { label: 'Phone layout', type: 'checkbox', checked: !!it.mobile, click: () => { it.mobile = !it.mobile; settingsStore.save(); dropPanel(id); toggleSidePanel(id); } },
      { label: 'Mute', type: 'checkbox', enabled: !!v, checked: !!v && v.webContents.isAudioMuted(), click: () => v.webContents.setAudioMuted(!v.webContents.isAudioMuted()) },
      { label: 'Close to save memory', enabled: !!v, click: () => { dropPanel(id); layout(); pushState(); } },
      { type: 'separator' },
    );
  }
  items.push({ label: 'Remove from sidebar', click: () => { dropPanel(id); settings.sidebarItems = settings.sidebarItems.filter((x) => x.id !== id); settingsStore.save(); layout(); pushState(); } });
  Menu.buildFromTemplate(items).popup({ window: win });
}

// Spotify Web API when signed in; the Windows media-controls helper below is the fallback
let spotify = null;
function initSpotify() {
  spotify = Spotify.create({ file: path.join(app.getPath('userData'), 'spotify.bin'), onChange: () => { layout(); pushState(); }, fast: () => settings.musicMode !== 'closed' });
}

function startMedia() {
  if (spotify) spotify.setActive(true);
  if (mediaProc || process.platform !== 'win32') return;
  const script = path.join(app.getPath('userData'), 'media.ps1');
  try { fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, 'media.ps1'))); } catch { return; }
  mediaProc = require('child_process').spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script], { windowsHide: true });
  let buf = '';
  mediaProc.stdout.on('data', (d) => {
    buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop();
    for (const l of lines) { try { media = JSON.parse(l); media.art = artFor(media); pushState(); } catch { /* ignore */ } }
  });
  mediaProc.on('exit', () => { mediaProc = null; media = { ok: false }; pushState(); });
}
// Album art for the Windows media fallback, looked up by artist + title (iTunes search: free, no key).
const artCache = new Map();
function artFor(m) {
  if (!m.ok || !m.title) return '';
  const key = `${m.artist}|${m.title}`;
  if (artCache.has(key)) return artCache.get(key);
  artCache.set(key, '');
  const q = new URLSearchParams({ term: `${m.artist} ${m.title}`.slice(0, 120), media: 'music', entity: 'song', limit: '1' });
  net.fetch('https://itunes.apple.com/search?' + q).then((r) => r.json()).then((j) => {
    const url = j?.results?.[0]?.artworkUrl100;
    if (!url) return;
    artCache.set(key, url.replace('100x100bb', '300x300bb'));
    if (media.ok && `${media.artist}|${media.title}` === key) { media.art = artCache.get(key); pushState(); }
  }).catch(() => {});
  return '';
}

// "open.spotify.com/playlist/ID?si=…" or "spotify:playlist:ID" -> "spotify:playlist:ID"
function spotifyUri(text) {
  const t = String(text || '').trim();
  let m = /^spotify:(playlist|album|artist|track|show|episode):([A-Za-z0-9]+)$/.exec(t);
  if (m) return `spotify:${m[1]}:${m[2]}`;
  m = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|artist|track|show|episode)\/([A-Za-z0-9]+)/.exec(t);
  return m ? `spotify:${m[1]}:${m[2]}` : '';
}
function addMusicPin(link, name) {
  const uri = spotifyUri(link);
  if (!uri) return toast('Paste a Spotify playlist or album link');
  if (settings.musicPins.some((p) => p.uri === uri)) return toast('Already pinned');
  const kind = uri.split(':')[1];
  setSetting('musicPins', [...settings.musicPins, { uri, name: String(name || '').trim().slice(0, 60) || kind[0].toUpperCase() + kind.slice(1) }]);
  // fill in the real name from Spotify's public oEmbed endpoint (no key needed)
  const [, k, id] = uri.split(':');
  net.fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(`https://open.spotify.com/${k}/${id}`)).then((r) => r.json()).then((j) => {
    const pin = settings.musicPins.find((p) => p.uri === uri);
    if (pin && j?.title && !name) { pin.name = j.title.slice(0, 60); if (j.thumbnail_url) pin.art = j.thumbnail_url; settingsStore.save(); pushState(); }
  }).catch(() => {});
}

function stopMedia() { if (spotify) spotify.setActive(false); if (mediaProc) { try { mediaProc.stdin.end(); mediaProc.kill(); } catch { /* ignore */ } mediaProc = null; } }
function mediaCmd(action, value) {
  if (action === 'open') return shell.openExternal('spotify:');
  if (action === 'search') { const q = String(value || '').trim().slice(0, 200); return q && shell.openExternal('spotify:search:' + encodeURIComponent(q)); }
  if (action === 'openUri') { const uri = spotifyUri(value); return uri && shell.openExternal(uri); }
  if (action === 'seek' && spotify && spotify.connected()) return spotify.seek(+value || 0);
  if (action === 'seek' && mediaProc) return mediaProc.stdin.write('seek ' + Math.max(0, Math.round(+value || 0)) + '\n');
  if (spotify && spotify.connected() && ['toggle', 'next', 'prev'].includes(action)) return spotify[action]();
  if (mediaProc && ['toggle', 'next', 'prev'].includes(action)) mediaProc.stdin.write(action + '\n');
}

function setEditMode(on) {
  editMode = !!on;
  activePanel = null;
  overlayOpen = !editMode; // force setOverlay to apply
  setOverlay(editMode);
  layout(); pushState();
}

// ───────────────────────────────────────────────────────────── session wiring (blocking, permissions, downloads)

// Account sign-ins (Google, Microsoft, Apple, GitHub…) often won't complete
// inside an embedded Chromium. When a tab lands on one, offer to open it in the
// user's default browser. No header spoofing — just a one-click hand-off.
const AUTH_HOSTS = ['accounts.google.com', 'accounts.youtube.com', 'login.live.com', 'login.microsoftonline.com', 'appleid.apple.com', 'github.com'];
function isAuthUrl(url) {
  try { const u = new URL(url); return AUTH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h)) && /sign|login|oauth|auth/i.test(u.pathname + u.search); } catch { return false; }
}
// Google refuses sign-in from embedded Chromium ("This browser or app may not be secure"),
// but accepts Firefox. Only Google's account pages see this identity; every other site gets Chrome's.
const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';
const isGoogleAuthHost = (url) => { try { const h = new URL(url).hostname; return h === 'accounts.google.com' || h === 'accounts.youtube.com'; } catch { return false; } };
const CHROME_UA = () => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

function setupSession() {
  tabSession = wireSession(session.fromPartition('persist:opentab'), false);
  privateSession = wireSession(session.fromPartition('opentab-private'), true);
}

function wireSession(tabSession, isPrivate) {
  tabSession.setUserAgent(CHROME_UA());

  // internal pages
  const MIME = { '.ttf': 'font/ttf', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
  tabSession.protocol.handle(SCHEME, (req) => {
    const u = new URL(req.url);
    let file = null;
    if (u.hostname === 'newtab') file = path.join(__dirname, 'pages', 'newtab.html');
    else if (u.hostname === 'error') file = path.join(__dirname, 'pages', 'error.html');
    else if (u.hostname === 'panel') file = path.join(__dirname, 'pages', 'panel.html');
    else if (u.hostname === 'assets') {
      const name = path.basename(u.pathname);
      if (['themes.css', 'logo.svg'].includes(name)) file = path.join(__dirname, 'ui', name);
      if (name === 'InstrumentSans.ttf') file = path.join(__dirname, 'ui', 'fonts', name);
      if (name === 'background') {
        try { return new Response(fs.readFileSync(BG_FILE()), { headers: { 'cache-control': 'no-store' } }); } catch { return new Response('Not found', { status: 404 }); }
      }
    }
    if (!file) return new Response('Not found', { status: 404 });
    try {
      return new Response(fs.readFileSync(file), { headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' } });
    } catch { return new Response('Not found', { status: 404 }); }
  });

  // ad + tracker blocking
  tabSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
    if (!settings.adblock) return cb({});
    if (d.resourceType === 'mainFrame') {
      if (settings.stripParams && siteBlockingOn(d.url)) { const clean = blocklist.stripTracking(d.url); if (clean) return cb({ redirectURL: clean }); }
      return cb({});
    }
    let host;
    try { host = new URL(d.url).hostname; } catch { return cb({}); }
    const wc = d.webContents;
    const tab = wc ? wcToTab.get(wc.id) : null;
    const topUrl = tab ? (wc.getURL() || tab.url) : (d.frame?.top?.url || d.referrer || '');
    const topHost = hostOf(topUrl);
    if (topHost && settings.allowlist.includes(blocklist.registrable(topHost))) return cb({});
    const hit = () => {
      settings.totalBlocked++; settingsStore.save();
      if (!tab) return;
      tab.blocked++;
      if (!tab.blockedHosts) tab.blockedHosts = new Map();
      if (tab.blockedHosts.size < 200 || tab.blockedHosts.has(host)) tab.blockedHosts.set(host, (tab.blockedHosts.get(host) || 0) + 1);
      pushState();
    };
    // comprehensive filter engine (EasyList etc.)
    if (adEngine && AdRequest) {
      try {
        const { match, redirect } = adEngine.match(AdRequest.fromRawDetails({ type: GH_TYPE[d.resourceType] || 'other', url: d.url, sourceUrl: topUrl }));
        if (redirect) return cb({ redirectURL: redirect.dataUrl });
        if (match) { hit(); return cb({ cancel: true }); }
        return cb({});
      } catch { /* fall through to the built-in list */ }
    }
    // fallback: small built-in list
    const thirdParty = topHost ? blocklist.registrable(host) !== blocklist.registrable(topHost) : true;
    let block = false;
    if (blocklist.hostBlocked(host) && (thirdParty || !topHost)) block = true;
    else if (thirdParty && blocklist.PATTERNS.some((re) => re.test(d.url))) block = true;
    if (block) { hit(); return cb({ cancel: true }); }
    return cb({});
  });

  tabSession.webRequest.onBeforeSendHeaders({ urls: ['http://*/*', 'https://*/*'] }, (d, cb) => {
    if (settings.adblock && settings.sendGpc) { d.requestHeaders['Sec-GPC'] = '1'; d.requestHeaders['DNT'] = '1'; }
    if (isGoogleAuthHost(d.url)) {
      d.requestHeaders['User-Agent'] = FIREFOX_UA;
      for (const k of Object.keys(d.requestHeaders)) if (/^sec-ch-ua/i.test(k)) delete d.requestHeaders[k];
    }
    cb({ requestHeaders: d.requestHeaders });
  });

  // permissions: decisions for normal tabs are saved; private tabs keep theirs in memory only
  const getDecision = (key) => (isPrivate ? privateDecisions.get(key) : permStore.data[key]);
  const ALWAYS = new Set(['clipboard-sanitized-write', 'fullscreen', 'pointerLock', 'speaker-selection', 'idle-detection']);
  const ASK = new Set(['media', 'geolocation', 'clipboard-read', 'midi', 'display-capture', 'mediaKeySystem']);
  tabSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    const origin = originOf(details.requestingUrl || wc.getURL());
    if (isInternal(details.requestingUrl || '')) return cb(true);
    if (permission === 'notifications') return cb(settings.notifications);
    if (ALWAYS.has(permission)) return cb(true);
    if (!ASK.has(permission) || !origin) return cb(false);
    // camera and microphone are remembered separately
    const kind = permission === 'media' ? mediaKind(details.mediaTypes) : permission;
    const key = `${origin}|${kind}`;
    const saved = getDecision(key);
    if (saved !== undefined) return cb(saved);
    // the same request again while one is waiting: answer both together
    const waiting = permPrompts.find((p) => p.wcId === wc.id && p.key === key);
    if (waiting) { waiting.cbs.push(cb); return; }
    permPrompts.push({ id: uid('q'), wcId: wc.id, key, origin, kind, cbs: [cb], isPrivate });
    layout(); pushState();
  });
  tabSession.setPermissionCheckHandler((wc, permission, origin) => {
    if (permission === 'notifications') return settings.notifications;
    if (ALWAYS.has(permission)) return true;
    const o = origin?.replace(/\/$/, '');
    if (permission === 'media') return ['camera', 'microphone', 'media'].some((k) => getDecision(`${o}|${k}`) === true);
    return getDecision(`${o}|${permission}`) === true;
  });

  // remember the certificate each site used, for the site info panel
  tabSession.setCertificateVerifyProc((req, cb) => {
    const c = req.certificate;
    if (c && req.errorCode === 0) {
      certs.set(req.hostname, { subject: c.subjectName, issuer: c.issuerName, validStart: c.validStart * 1000, validExpiry: c.validExpiry * 1000, fingerprint: c.fingerprint });
      if (certs.size > 500) certs.delete(certs.keys().next().value);
    }
    cb(-3); // keep Chromium's own verdict
  });

  downloads.attach(tabSession, { isPrivate });
  return tabSession;
}

// ───────────────────────────────────────────────────────────── permission prompts (bar under the toolbar)
const PERM_BAR_H = 52;
const PERM_LABEL = {
  camera: 'Camera', microphone: 'Microphone', media: 'Camera and microphone', geolocation: 'Location', 'clipboard-read': 'Clipboard',
  midi: 'MIDI devices', 'display-capture': 'Screen sharing', mediaKeySystem: 'Protected content',
};
const PERM_ASK = {
  camera: 'use your camera', microphone: 'use your microphone', media: 'use your camera and microphone', geolocation: 'know your location',
  'clipboard-read': 'see text and images you copy', midi: 'use MIDI devices', 'display-capture': 'see your screen', mediaKeySystem: 'play protected content',
};
const permPrompts = [];             // { id, wcId, key, origin, kind, cbs, isPrivate }
const privateDecisions = new Map(); // private tabs: forgotten when the last one closes
const certs = new Map();            // hostname -> certificate summary
const originOf = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.origin : ''; } catch { return ''; } };
function mediaKind(types) {
  const t = types || [];
  if (t.includes('video') && !t.includes('audio')) return 'camera';
  if (t.includes('audio') && !t.includes('video')) return 'microphone';
  return 'media';
}

// the prompt for whatever is on screen: the active tab or the open sidebar panel
function visiblePermPrompt() {
  if (!permPrompts.length) return null;
  const at = activeTab();
  const ids = new Set();
  if (at?.view && !at.view.webContents.isDestroyed()) ids.add(at.view.webContents.id);
  const pv = activePanel && panels.get(activePanel);
  if (pv && !pv.webContents.isDestroyed()) ids.add(pv.webContents.id);
  const p = permPrompts.find((x) => ids.has(x.wcId));
  return p ? { id: p.id, host: p.origin.replace(/^https?:\/\//, ''), text: PERM_ASK[p.kind] || p.kind, kind: p.kind, private: p.isPrivate } : null;
}

function answerPermPrompt(id, answer) {
  const i = permPrompts.findIndex((p) => p.id === id);
  if (i < 0) return;
  const p = permPrompts.splice(i, 1)[0];
  const allow = answer === 'allow' || answer === 'once';
  if (answer === 'allow' || answer === 'block') {
    if (p.isPrivate) privateDecisions.set(p.key, allow);
    else { permStore.data[p.key] = allow; permStore.save(); }
  }
  p.cbs.forEach((cb) => cb(allow));
  // other waiting requests that a remembered answer now covers
  if (answer !== 'once' && answer !== 'dismiss') dropPermPrompts((x) => x.key === p.key && x.isPrivate === p.isPrivate, allow);
  layout(); pushState();
}

function dropPermPrompts(match, allow = false) {
  let n = 0;
  for (let i = permPrompts.length - 1; i >= 0; i--) {
    if (!match(permPrompts[i])) continue;
    permPrompts.splice(i, 1)[0].cbs.forEach((cb) => cb(allow)); n++;
  }
  if (n && ui) { layout(); pushState(); }
}

function forgetPermission(key) {
  if (key in permStore.data) { delete permStore.data[key]; permStore.save(); }
  privateDecisions.delete(key);
  pushState();
}

// site info panel (click the lock in the address bar)
async function siteInfo() {
  const at = activeTab();
  if (!at || isInternal(at.url)) return null;
  const origin = originOf(at.url);
  const host = hostOf(at.url);
  const ses = at.private ? privateSession : tabSession;
  let cookies = 0;
  try { cookies = (await ses.cookies.get({ url: at.url })).length; } catch { /* ignore */ }
  const store = at.private ? Object.fromEntries(privateDecisions) : permStore.data;
  const perms = Object.entries(store).filter(([k]) => k.startsWith(origin + '|')).map(([k, allow]) => ({ key: k, label: PERM_LABEL[k.split('|')[1]] || k.split('|')[1], allow }));
  return { host, origin, secure: at.url.startsWith('https://'), cert: certs.get(host) || null, cookies, perms, private: at.private };
}

async function clearSiteData() {
  const at = activeTab();
  const origin = at && originOf(at.url);
  if (!origin) return;
  const ses = at.private ? privateSession : tabSession;
  await ses.clearStorageData({ origin }).catch(() => {});
  // cookies are often set on the parent domain too (".example.com")
  const site = siteKey(at.url);
  for (const c of await ses.cookies.get({}).catch(() => [])) {
    const d = (c.domain || '').replace(/^\./, '');
    if (d === site || d.endsWith('.' + site)) await ses.cookies.remove(`http${c.secure ? 's' : ''}://${d}${c.path || '/'}`, c.name).catch(() => {});
  }
  if (at.private) { for (const k of [...privateDecisions.keys()]) if (k.startsWith(origin + '|')) privateDecisions.delete(k); }
  else { for (const k of Object.keys(permStore.data)) if (k.startsWith(origin + '|')) delete permStore.data[k]; permStore.save(); }
  toast(`Cleared data for ${hostOf(at.url)}`);
  at.view?.webContents.reload();
  pushState();
}

// memory per tab (from Chromium's process metrics)
function tabMemory() {
  const byPid = new Map(app.getAppMetrics().map((m) => [m.pid, m.memory?.workingSetSize || 0]));
  const seen = new Set();
  const list = wsTabs(activeWorkspaceId).map((t) => {
    let kb = 0;
    if (t.view && !t.view.webContents.isDestroyed()) {
      const pid = t.view.webContents.getOSProcessId();
      // tabs from the same site can share a process; count it once
      if (!seen.has(pid)) { kb = byPid.get(pid) || 0; seen.add(pid); }
    }
    return { id: t.id, title: t.title, url: isInternal(t.url) ? '' : t.url, favicon: t.favicon, sleeping: !t.view, pinned: t.pinned, audible: t.audible, active: t === activeTab(), mb: Math.round(kb / 1024) };
  });
  const total = [...byPid.values()].reduce((a, b) => a + b, 0);
  return { tabs: list, totalMb: Math.round(total / 1024) };
}

// ───────────────────────────────────────────────────────────── commands from UI
const cmd = {
  newTab: (a) => createTab({ url: a?.url, private: !!a?.private }),
  closeTab: (a) => closeTab(a.id),
  activateTab: (a) => activateTab(a.id),
  moveTab: (a) => moveTab(a.id, a.beforeId),
  pinTab: (a) => { const t = tabById.get(a.id); if (!t) return; t.pinned = !!a.pinned; if (t.pinned) t.groupId = null; groups = groups.filter((g) => tabs.some((x) => x.groupId === g.id)); if (t.pinned) ensureView(t); pushState(); saveSession(); },
  tabMenu: (a) => tabMenu(a.id),
  groupMenu: (a) => groupMenu(a.id),
  workspaceMenu: (a) => workspaceMenu(a.id),
  createGroup: (a) => { createGroup(a.tabIds || []); },
  addToGroup: (a) => addToGroup(a.tabId, a.groupId),
  toggleGroup: (a) => { const g = groups.find((x) => x.id === a.id); if (g) { g.collapsed = !g.collapsed; pushState(); saveSession(); } },
  renameGroup: (a) => { const g = groups.find((x) => x.id === a.id); if (g) { g.name = String(a.name || '').slice(0, 30); pushState(); saveSession(); } },
  createWorkspace: (a) => createWorkspace(a || {}),
  switchWorkspace: (a) => switchWorkspace(a.id),
  renameWorkspace: (a) => { const w = workspaces.find((x) => x.id === a.id); if (w) { w.name = String(a.name || w.name).slice(0, 24); if (a.emoji !== undefined) w.emoji = a.emoji; pushState(); saveSession(); } },
  navigate: (a) => navigateActive(a.text),
  reload: () => { const at = activeTab(); if (!at) return; if (!at.view || at.crashed) { destroyView(at); ensureView(at); layout(); } else if (at.loading) at.view.webContents.stop(); else at.view.webContents.reload(); },
  hardReload: () => activeTab()?.view?.webContents.reloadIgnoringCache(),
  back: () => { const wc = activeTab()?.view?.webContents; if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); },
  forward: () => { const wc = activeTab()?.view?.webContents; if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); },
  home: () => navigateActive('opentab://newtab'),
  setOverlay: (a) => setOverlay(a.open),
  setSetting: (a) => setSetting(a.key, a.value),
  toggleBookmark: () => toggleBookmark(),
  removeBookmark: (a) => { const i = bookmarksStore.data.findIndex((b) => b.id === a.id); if (i >= 0) { bookmarksStore.data.splice(i, 1); bookmarksStore.save(); sendBookmarks(); pushState(); } },
  openUrl: (a) => { setOverlay(false); if (a.newTab) createTab({ url: a.url }); else navigateActive(a.url); },
  syncNow: () => syncFromBrowsers(true),
  importHTML: () => importHTMLFile(),
  exportHTML: () => exportHTMLFile(),
  pip: () => togglePip(),
  find: (a) => {
    const wc = activeTab()?.view?.webContents; if (!wc) return;
    findState.text = a.text || '';
    if (!a.text) { wc.stopFindInPage('clearSelection'); ui.webContents.send('find-result', { text: '', active: 0, matches: 0 }); return; }
    wc.findInPage(a.text, { forward: a.forward !== false, findNext: !!a.next });
  },
  stopFind: () => activeTab()?.view?.webContents.stopFindInPage('clearSelection'),
  siteBlock: (a) => {
    const site = a.site; if (!site) return;
    const list = settings.allowlist;
    const i = list.indexOf(site);
    if (a.enabled && i >= 0) list.splice(i, 1);
    if (!a.enabled && i < 0) list.push(site);
    settingsStore.save();
    activeTab()?.view?.webContents.reload();
    pushState();
  },
  devtools: () => { const wc = activeTab()?.view?.webContents; if (wc) wc.isDevToolsOpened() ? wc.closeDevTools() : wc.openDevTools({ mode: 'right' }); },
  clearData: async (a) => {
    if (a.history) { historyStore.data = []; historyStore.save(); }
    if (a.site) { await tabSession.clearStorageData(); await tabSession.clearCache(); }
    if (a.permissions) { for (const k of Object.keys(permStore.data)) delete permStore.data[k]; permStore.save(); }
    settings.totalBlocked = a.counter ? 0 : settings.totalBlocked;
    toast('Browsing data cleared');
    pushState();
  },
  setDefault: () => {
    app.setAsDefaultProtocolClient('http'); app.setAsDefaultProtocolClient('https');
    if (process.platform === 'win32') shell.openExternal('ms-settings:defaultapps');
    toast('Choose opentab in Windows “Default apps”');
  },
  getHistory: () => historyStore.data.slice(0, 400),
  suggest: (a) => suggest(a.text),
  minimize: () => win?.minimize(),
  toggleMaximize: () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()),
  closeWindow: () => win?.close(),
  lockClose: () => win?.close(),
  lockQuit: () => cmd.quit(),
  copyText: (a) => { clipboard.writeText(String(a?.text || '')); toast('Copied'); },
  openExternal: (a) => { const u = a?.url || activeTab()?.url; if (/^https?:/i.test(u || '')) { shell.openExternal(u); toast('Opened in your default browser'); } },
  pickBackground: () => pickBackground(),
  matchColors: () => matchColorsToImage(false),
  detachTab: (a) => detachTab(a.id),
  togglePanel: (a) => toggleSidePanel(a.id),
  addPanel: (a) => addSidePanel(a.url),
  panelMenu: (a) => panelMenu(a.id),
  musicMode: (a) => { if (['open', 'mini', 'closed'].includes(a.mode)) { if (!settings.mediaDock) setSetting('mediaDock', true); setSetting('musicMode', a.mode); } },
  mediaCmd: (a) => mediaCmd(a.action, a.value),
  addMusicPin: (a) => addMusicPin(a.link, a.name),
  removeMusicPin: (a) => setSetting('musicPins', settings.musicPins.filter((p) => p.uri !== a.uri)),
  spotify: (a) => {
    if (!spotify) return null;
    const SAFE = ['connect', 'disconnect', 'toggle', 'next', 'prev', 'seek', 'volume', 'shuffle', 'repeat', 'like', 'play', 'search', 'playlists'];
    if (!SAFE.includes(a.action)) return null;
    if (a.action === 'connect') { spotify.connect(); return null; }
    if (a.action === 'disconnect') { spotify.disconnect(); layout(); return null; }
    if (a.action === 'search') return spotify.search(String(a.q || '').slice(0, 200)).catch(() => []);
    if (a.action === 'playlists') return spotify.playlists().catch(() => []);
    if (a.action === 'play') return /^spotify:/.test(a.uri || a.context || '') ? spotify.play(a) : null;
    return spotify[a.action](a.value);
  },
  setEditMode: (a) => setEditMode(a.on),
  connect: (a) => {
    if (a.app === 'spotify') { setSetting('mediaDock', !settings.mediaDock); if (settings.mediaDock) setSetting('musicMode', 'open'); }
  },
  checkUpdates: () => checkForUpdates(true),
  installUpdate: () => installUpdate(),
  // downloads
  download: (a) => downloads.action(a.id, a.action),
  clearDownloads: () => downloads.clearFinished(),
  openDownloadsFolder: () => shell.openPath(app.getPath('downloads')),
  // permissions + site info
  answerPermission: (a) => answerPermPrompt(a.id, a.answer),
  forgetPermission: (a) => forgetPermission(String(a.key || '')),
  siteInfo: () => siteInfo(),
  clearSiteData: () => clearSiteData(),
  // filter lists
  updateFilters: () => setupAdblock(true),
  // memory
  tabMemory: () => tabMemory(),
  sleepTab: (a) => { const t = tabById.get(a.id); if (t && t !== activeTab()) { sleepTab(t); pushState(); } },
  // extensions
  addExtension: async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose an unpacked extension folder (with a manifest.json)', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return;
    const ext = await extensions.add(r.filePaths[0]);
    toast(ext.error ? `Couldn’t load extension: ${ext.error}` : `Added ${ext.name}`);
    pushState();
  },
  removeExtension: (a) => { extensions.remove(String(a.path || '')); toast('Extension removed'); pushState(); },
  dismissWhatsNew: () => { whatsNew = null; pushState(); },
  quit: () => { quitting = true; app.quit(); },
};

function senderIsUI(e) { return [ui, side, dockMedia, lockView].some((v) => v && !v.webContents.isDestroyed() && e.sender === v.webContents); }

ipcMain.handle('cmd', async (e, name, args) => {
  if (!senderIsUI(e)) return null;
  if (!Object.prototype.hasOwnProperty.call(cmd, name)) return null;
  try { const out = await cmd[name](args || {}); return ['getHistory', 'suggest', 'spotify', 'siteInfo', 'tabMemory'].includes(name) ? out : null; } catch (err) { console.error('cmd error', name, err); crash.report('cmd-' + name, err); return null; }
});
ipcMain.handle('ready', (e) => { if (!senderIsUI(e)) return; sendState(); sendBookmarks(); });

// internal pages (new tab / error)
ipcMain.handle('page:home', (e) => {
  if (!isInternal(e.sender.getURL())) return null;
  const tab = wcToTab.get(e.sender.id);
  const bm = bookmarksStore.data.filter((b) => !b.folder).slice(0, 12);
  const extra = bookmarksStore.data.filter((b) => b.folder).slice(0, 12 - bm.length);
  return {
    theme: settings.theme, custom: THEMES.custom, accent: accentColors().accent, onAccent: accentColors().on, corners: settings.corners, font: settings.font,
    background: settings.ntBackground, dim: settings.ntDim, shortcuts: settings.ntShortcuts, clock: settings.ntClock, logo: settings.ntLogo,
    engine: (SEARCH_ENGINES[settings.searchEngine] || SEARCH_ENGINES.google).name,
    tiles: [...bm, ...extra].map((b) => ({ title: b.title, url: b.url })),
    recent: historyStore.data.slice(0, 6).map((h) => ({ title: h.title, url: h.url })),
    totalBlocked: settings.totalBlocked, tabBlocked: tab?.blocked || 0, adblock: settings.adblock,
  };
});
ipcMain.handle('page:panel', (e, name) => {
  if (!isInternal(e.sender.getURL())) return null;
  const base = { theme: settings.theme, custom: THEMES.custom, accent: accentColors().accent, onAccent: accentColors().on, corners: settings.corners, font: settings.font };
  if (name === 'bookmarks') return { ...base, items: bookmarksStore.data.filter((b) => !b.folder && b.url).map((b) => ({ title: b.title, url: b.url })) };
  if (name === 'history') return { ...base, items: historyStore.data.slice(0, 300).map((x) => ({ title: x.title, url: x.url, ts: x.t || 0 })) };
  if (name === 'tabs') return { ...base, items: wsTabs(activeWorkspaceId).map((t) => ({ id: t.id, title: t.title, url: isInternal(t.url) ? '' : t.url, favicon: t.favicon, active: t.id === wsActive().activeTabId, private: t.private })) };
  if (name === 'notes') return { ...base, text: settings.notes };
  return base;
});
ipcMain.handle('page:open', (e, url) => { if (isInternal(e.sender.getURL()) && /^https?:/i.test(url)) createTab({ url }); });
ipcMain.handle('page:activate', (e, id) => { if (isInternal(e.sender.getURL()) && tabById.has(id)) activateTab(id); });
ipcMain.handle('page:closeTab', (e, id) => { if (isInternal(e.sender.getURL()) && tabById.has(id)) closeTab(id); });
ipcMain.handle('page:notes', (e, text) => { if (isInternal(e.sender.getURL())) { settings.notes = String(text).slice(0, 100000); settingsStore.save(); } });

ipcMain.handle('page:go', (e, text) => {
  if (!isInternal(e.sender.getURL())) return;
  const tab = wcToTab.get(e.sender.id);
  if (!tab) return;
  if (tab !== activeTab()) activateTab(tab.id);
  navigateActive(text);
});

// ───────────────────────────────────────────────────────────── auto update
// Installers are published to github.com/adamproksch/opentab-releases (see "publish" in package.json).
// The app checks on launch and every few hours, downloads in the background,
// and installs when the user restarts (or on the next quit).
let autoUpdater = null;
const update = { status: 'idle', version: null, progress: 0 };

function setUpdate(patch) { Object.assign(update, patch); pushState(); }

function setupUpdater() {
  // dev runs and the portable .exe can't update themselves
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) { update.status = 'unsupported'; return; }
  try { ({ autoUpdater } = require('electron-updater')); } catch { update.status = 'unsupported'; return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;
  autoUpdater.on('checking-for-update', () => setUpdate({ status: 'checking' }));
  autoUpdater.on('update-not-available', () => setUpdate({ status: 'none' }));
  autoUpdater.on('update-available', (info) => setUpdate({ status: 'downloading', version: info.version, progress: 0 }));
  autoUpdater.on('download-progress', (p) => setUpdate({ status: 'downloading', progress: p.percent }));
  autoUpdater.on('update-downloaded', (info) => {
    // kept so the next launch can show what changed
    settings.updateNotes = { version: info.version, text: notesText(info.releaseNotes) };
    settingsStore.save();
    setUpdate({ status: 'ready', version: info.version, progress: 100 });
    toast(`opentab ${info.version} is ready. Restart to update.`);
  });
  autoUpdater.on('error', () => setUpdate({ status: update.status === 'ready' ? 'ready' : 'error' }));

  setTimeout(() => checkForUpdates(false), 8000);
  setInterval(() => checkForUpdates(false), UPDATE_CHECK_MS);
}

function checkForUpdates(manual) {
  if (!autoUpdater || update.status === 'ready' || update.status === 'downloading') return;
  if (!manual && !settings.autoUpdate) return;
  autoUpdater.checkForUpdates().catch(() => setUpdate({ status: 'error' }));
}

// GitHub release notes arrive as HTML (or a list of them); the UI shows plain text
function notesText(notes) {
  const html = Array.isArray(notes) ? notes.map((n) => n.note || '').join('\n\n') : String(notes || '');
  return html
    .replace(/<\/(p|li|h\d|div)>|<br\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000);
}

// first launch after an update: "what's new" card
let whatsNew = null;
function checkWhatsNew() {
  const v = app.getVersion();
  if (settings.lastVersion && settings.lastVersion !== v) {
    const n = settings.updateNotes;
    whatsNew = { version: v, text: n && n.version === v ? n.text : '' };
  }
  settings.lastVersion = v; settings.updateNotes = null;
  settingsStore.save();
}

function installUpdate() {
  if (!autoUpdater || update.status !== 'ready') return;
  quitting = true;
  saveSession();
  autoUpdater.quitAndInstall(true, true); // silent install, then relaunch
}

// ───────────────────────────────────────────────────────────── app lifecycle
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.on('second-instance', (e, argv) => {
    showWindow();
    const url = argv.find((a) => /^https?:\/\//i.test(a));
    if (url) createTab({ url });
  });

  app.setAppUserModelId('com.opentab.browser');

  app.whenReady().then(() => {
    settingsStore = makeStore('settings.json', () => ({ ...DEFAULT_SETTINGS }));
    const savedVersion = settingsStore.data.settingsVersion || 1;
    settings = { ...DEFAULT_SETTINGS, ...settingsStore.data };
    syncCustomTheme();
    // v2: Google becomes the default search engine for everyone
    if (savedVersion < 2) settings.searchEngine = 'google';
    // v3: greyscale look and rounder corners by default
    if (savedVersion < 3) {
      if (!THEMES[settings.theme]) settings.theme = 'ink';
      settings.accent = 'auto';
      settings.corners = 'round';
    }
    settings.settingsVersion = 3;
    settingsStore.data = settings;
    bookmarksStore = makeStore('bookmarks.json', []);
    historyStore = makeStore('history.json', []);
    sessionStore = makeStore('session.json', null);
    permStore = makeStore('permissions.json', {});

    Menu.setApplicationMenu(null);
    downloads.cleanup(); // leftovers if the last run didn't quit cleanly
    setupSession();
    extensions = createExtensions({ session: tabSession, paths: () => settings.extensions, savePaths: (p) => { settings.extensions = p; settingsStore.save(); } });
    extensions.loadAll().then(pushState);
    checkWhatsNew();
    setupAdblock();
    applyTheme();
    createWindow();
    updateTray();
    scheduleAutoSync();
    setupUpdater();
    ensureUserId();
    checkin();
    setInterval(checkin, CHECKIN_MS);

    // tab sleeping keeps memory low
    setInterval(() => {
      const mins = settings.sleepMinutes;
      if (!mins) return;
      const now = Date.now(); const at = activeTab();
      for (const t of tabs) {
        if (t === at || t.pinned || t.audible || !t.view) continue;
        if (now - t.lastActive > mins * 60 * 1000) sleepTab(t);
      }
      pushState();
    }, 60 * 1000);

    app.on('activate', () => { if (!win) createWindow(); else showWindow(); });
  });

  app.on('before-quit', () => {
    quitting = true;
    try { saveSession(); settingsStore.flush(); bookmarksStore.flush(); historyStore.flush(); sessionStore.flush(); permStore.flush(); } catch { /* ignore */ }
    downloads.cleanup(); // risky downloads nobody chose to keep
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !tray) app.quit(); });
}
