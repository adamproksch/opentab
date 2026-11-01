'use strict';
/* opentab browser chrome (tab strip, toolbar, panels) */
const $ = (s) => document.querySelector(s);
const api = window.opentab;
const cmd = (n, a) => api.cmd(n, a);

// ───────────────────────────────────────────── icons
const P = {
  back: '<path d="M15 18l-6-6 6-6"/>', fwd: '<path d="M9 18l6-6-6-6"/>',
  reload: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  prev: '<path d="M18 6v12L9 12zM6 6v12"/>', next: '<path d="M6 6v12l9-6zM18 6v12"/>',
  play: '<path d="M8 5v14l11-7z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  star: '<path d="M12 2.5l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 18l-6.2 3.6L7 14.7 2 9.8l6.9-1z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  pip: '<rect x="2" y="4" width="20" height="16" rx="3"/><rect x="12" y="11" width="7" height="5" rx="1.5" fill="currentColor" stroke="none"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5"/>',
  dots: '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  spk: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  mute: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  chev: '<path d="M6 9l6 6 6-6"/>', chevr: '<path d="M9 6l6 6-6 6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="M18 15l-6-6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  find: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  power: '<path d="M12 3v9"/><path d="M6.4 6.4a8 8 0 1 0 11.2 0"/>',
  mask: '<path d="M3 11c0-2 1.5-3 3-3h12c1.5 0 3 1 3 3v1c0 2.5-2 4-4.5 4-1.7 0-2.6-1-3-2h-3c-.4 1-1.3 2-3 2C5 16 3 14.5 3 12z"/>',
  newtab: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 9v6M9 12h6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/>',
  winMin: '<path d="M5 12h14"/>', winMax: '<rect x="5" y="5" width="14" height="14"/>',
  winRestore: '<rect x="5" y="8" width="11" height="11"/><path d="M8 8V5h11v11h-3"/>', winClose: '<path d="M6 6l12 12M18 6L6 18"/>',
  update: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 19h16"/>',
  download: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M5 20h14"/>',
  pauseSm: '<path d="M9 6v12M15 6v12"/>', playSm: '<path d="M8 5v14l11-7z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  puzzle: '<path d="M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
};
const icon = (n, cls) => `<svg viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''}>${P[n]}</svg>`;

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  // keyboard and screen reader access: clickable divs act as buttons, icon buttons are named by their tooltip
  if (tag !== 'button' && attrs?.onclick && !el.hasAttribute('tabindex')) { el.tabIndex = 0; if (!el.hasAttribute('role')) el.setAttribute('role', 'button'); }
  if (attrs?.title && !el.hasAttribute('aria-label') && (tag === 'button' || el.getAttribute('role') === 'button')) el.setAttribute('aria-label', attrs.title);
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
const initial = (s) => (String(s || '?').replace(/^https?:\/\/(www\.)?/, '')[0] || '?').toUpperCase();
function colorOf(s) {
  let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0;
  return `hsl(0 0% ${28 + (Math.abs(x) % 30)}%)`;
}
function hostname(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function nice(url) { return String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, ''); }

// ───────────────────────────────────────────── state
let S = null;            // state from main
let BM = [];             // bookmarks
let panel = null;        // { name, anchor, align }
let dragging = false;
const seenTabs = new Set();
let lastActiveId = null;
let pendingRender = false;
let omniEditing = false;
let sugs = [], sugSel = -1, sugSeq = 0;
let findInfo = { text: '', active: 0, matches: 0 };
let histCache = [];
let libTab = 'bookmarks', libQuery = '', menuTab = 'general';
let toastTimerUI = null;
let wsEdit = null;       // { id, name } | { create: true }

const ACCENTS = ['#ffffff', '#a3a3a3', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
// shown in Settings → Keys
const SHORTCUTS = [
  ['Tabs', [
    ['Ctrl+T or Ctrl+N', 'New tab'], ['Ctrl+Shift+N', 'New private tab'], ['Ctrl+W or Ctrl+F4', 'Close tab'],
    ['Ctrl+Shift+T', 'Reopen closed tab'], ['Ctrl+Shift+D', 'Duplicate tab'], ['Ctrl+Shift+P', 'Pin or unpin tab'],
    ['Ctrl+M', 'Mute or unmute tab'], ['Ctrl+Shift+X', 'Close other tabs'], ['Ctrl+Tab / Ctrl+PgDn', 'Next tab'],
    ['Ctrl+Shift+Tab / Ctrl+PgUp', 'Previous tab'], ['Ctrl+Shift+PgUp / PgDn', 'Move tab left / right'], ['Ctrl+1 … Ctrl+8', 'Go to tab 1–8'], ['Ctrl+9', 'Go to last tab'],
  ]],
  ['Pages', [
    ['Ctrl+L, Ctrl+K, Ctrl+E, Alt+D, F6', 'Focus address bar'], ['Ctrl+R or F5', 'Reload'], ['Ctrl+Shift+R or Ctrl+F5', 'Hard reload'],
    ['Esc', 'Stop loading'], ['Alt+← / Alt+→', 'Back / forward'], ['Alt+Home', 'New tab page'], ['Ctrl+F', 'Find on page'],
    ['Ctrl+G or F3', 'Find next'], ['Ctrl+Shift+G or Shift+F3', 'Find previous'], ['Ctrl+= / Ctrl+-', 'Zoom in / out'], ['Ctrl+0', 'Reset zoom'],
    ['Ctrl+P', 'Print'], ['Ctrl+S', 'Save page'], ['Ctrl+Shift+C', 'Copy page link'], ['Alt+P', 'Pop out video'],
  ]],
  ['Browser', [
    ['Ctrl+D', 'Bookmark page'], ['Ctrl+Shift+O', 'Bookmarks'], ['Ctrl+Shift+B', 'Show or hide bookmarks bar'], ['Ctrl+H', 'History'], ['Ctrl+J', 'Downloads'],
    ['Ctrl+Shift+S', 'Show or hide sidebar'], ['Alt+1 … Alt+9', 'Open sidebar panel 1–9'], ['Ctrl+Shift+E', 'Edit layout'],
    ['Ctrl+,', 'Settings'], ['Ctrl+/', 'Keyboard shortcuts'], ['Ctrl+Shift+L', 'Next theme'], ['Ctrl+Shift+V', 'Vertical or top tabs'],
    ['F11', 'Full screen'], ['F12 or Ctrl+Shift+I', 'Developer tools'], ['Ctrl+Shift+Q', 'Quit'],
  ]],
];
const BACKGROUNDS = ['#181818', '#000000', '#f2f2f2', '#1e293b', '#14532d', '#7f1d1d', '#312e81', '#831843'];
const GRADIENTS = {
  dusk: 'linear-gradient(135deg,#1e1b4b,#831843)', ocean: 'linear-gradient(135deg,#0c4a6e,#134e4a)', sunset: 'linear-gradient(135deg,#f97316,#db2777)',
  forest: 'linear-gradient(135deg,#052e16,#365314)', aurora: 'linear-gradient(135deg,#0f172a,#0d9488,#7c3aed)', peach: 'linear-gradient(135deg,#fed7aa,#fbcfe8)',
};
const EMOJIS = ['🏠', '💼', '🎮', '📚', '🎵', '🛒', '💬', '🧪', '✈️', '🎨'];

// static icons
$('#newTab').innerHTML = icon('plus');
$('#back').innerHTML = icon('back'); $('#fwd').innerHTML = icon('fwd'); $('#reload').innerHTML = icon('reload');
$('#star').innerHTML = icon('star'); $('#menu').innerHTML = icon('menu');
const fmtBytes = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? Math.round(n / 1e3) + ' KB' : (n || 0) + ' B');
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const PANEL_NAMES = { menu: 'Menu', settings: 'Settings', shield: 'Shield', ws: 'Workspaces', find: 'Find on page', downloads: 'Downloads', site: 'Site information', memory: 'Tabs and memory', whatsnew: 'What’s new', suggest: 'Suggestions' };

// custom window buttons (Windows/Linux). macOS keeps its own traffic lights.
const caption = h('div', { class: 'caption' },
  h('button', { title: 'Minimize', html: icon('winMin'), onclick: () => cmd('minimize') }),
  h('button', { id: 'maxBtn', title: 'Maximize', onclick: () => cmd('toggleMaximize') }),
  h('button', { class: 'close', title: 'Close', html: icon('winClose'), onclick: () => cmd('closeWindow') }));
caption.addEventListener('dblclick', (e) => e.stopPropagation());

// ───────────────────────────────────────────── rendering
function render() {
  if (!S) return;
  if (dragging) { pendingRender = true; return; }
  const st = S.settings;
  const b = document.body, root = document.documentElement.style;
  const vertical = st.tabPosition === 'left' || st.tabPosition === 'right';
  Object.assign(b.dataset, { theme: st.theme, tabs: st.tabPosition, density: st.density, corners: st.corners, font: st.font, bmbar: st.bookmarksBar ? '1' : '0' });
  if (S.custom) { root.setProperty('--cbg', S.custom.bg); root.setProperty('--cfg', S.custom.fg); }
  b.style.colorScheme = st.theme === 'custom' && S.custom ? (S.custom.dark ? 'dark' : 'light') : '';
  b.classList.toggle('vertical', vertical);
  root.setProperty('--accent', S.accentColor);
  root.setProperty('--on-accent', S.onAccent);
  root.setProperty('--chrome-h', (vertical ? 0 : S.chromeH) + 'px');
  root.setProperty('--side-w', st.sideWidth + 'px');
  b.classList.toggle('overlay', !!S.overlayOpen);
  if (S.platform === 'darwin') { $('#tabstrip').style.paddingLeft = vertical ? '' : '80px'; $('#sideHead').style.paddingLeft = '80px'; }
  else {
    const home = vertical ? $('#sideHead') : $('#tabstrip');
    if (caption.parentNode !== home) home.append(caption);
    const mx = $('#maxBtn'); mx.innerHTML = icon(S.maximized ? 'winRestore' : 'winMax'); mx.title = S.maximized ? 'Restore' : 'Maximize';
  }
  if (S.fullscreen) $('#chrome').style.display = 'none'; else $('#chrome').style.display = '';

  renderWorkspaceBtn(); renderTabs(); renderToolbar(); renderBookmarksBar();
  if (panel) renderPanel();
}

function renderWorkspaceBtn() {
  const w = S.workspaces.find((x) => x.id === S.activeWorkspaceId);
  const b = $('#wsBtn');
  b.hidden = !S.settings.workspaces;
  b.className = 'ws-btn nodrag' + (panel?.name === 'ws' ? ' on' : '');
  b.innerHTML = '';
  if (!w) return; // first state push can arrive before workspaces are restored
  if (w.emoji) b.append(h('span', {}, w.emoji)); else b.append(h('span', { class: 'dot', style: { background: w.color } }));
  b.append(h('span', { class: 'nm' }, w.name), h('span', { html: icon('chev') }));
}

function faviconEl(t) {
  if (t.loading) return h('div', { class: 'spin' });
  if (!t.url && !t.favicon) return h('div', { class: 'fav internal' }, h('img', { src: 'logo.svg' }));
  if (t.favicon) {
    const img = h('img', { src: t.favicon, draggable: 'false' });
    const box = h('div', { class: 'fav', style: { background: 'transparent' } }, img);
    img.addEventListener('error', () => { box.style.background = colorOf(hostname(t.url)); box.textContent = initial(hostname(t.url)); });
    return box;
  }
  return h('div', { class: 'fav', style: { background: colorOf(hostname(t.url)) } }, initial(hostname(t.url) || t.title));
}

function tabEl(t, opts = {}) {
  const el = h('div', {
    class: `tab${t.private ? ' private' : ''}${seenTabs.has(t.id) ? '' : ' new'}${t.id === S.activeTabId ? ' active' : ''}${t.id === S.activeTabId && lastActiveId !== t.id ? ' just-active' : ''}${t.sleeping ? ' sleeping' : ''}${opts.pin ? ' pin' : ''}${opts.compact ? ' compact' : ''}`,
    draggable: 'true', 'data-id': t.id, title: t.title + (t.url ? '\n' + t.url : ''),
    role: 'tab', 'aria-selected': String(t.id === S.activeTabId), tabindex: t.id === S.activeTabId ? '0' : '-1',
    'aria-label': [t.private ? 'Private' : '', t.pinned ? 'Pinned' : '', t.title || 'Untitled', t.loading ? 'loading' : '', t.audible && !t.muted ? 'playing audio' : '', t.muted ? 'muted' : '', t.sleeping ? 'sleeping' : ''].filter(Boolean).join(', '),
    onmousedown: (e) => { if (e.button === 0) cmd('activateTab', { id: t.id }); if (e.button === 1) { e.preventDefault(); cmd('closeTab', { id: t.id }); } },
    oncontextmenu: (e) => { e.preventDefault(); cmd('tabMenu', { id: t.id }); },
    onkeydown: (e) => tabKey(e, t),
  });
  el.append(faviconEl(t));
  if (!opts.pin) el.append(h('span', { class: 'title' }, t.title || 'Untitled'));
  if (t.badge) el.append(h('span', { class: 'badge' }, t.badge > 99 ? '99+' : String(t.badge)));
  if (t.audible || t.muted) el.append(h('span', { class: 'aud', html: icon(t.muted ? 'mute' : 'spk'), onmousedown: (e) => { e.stopPropagation(); cmd('tabMenu', { id: t.id }); } }));
  if (!opts.pin) el.append(h('button', { class: 'x', html: icon('x'), title: 'Close tab', onmousedown: (e) => { e.stopPropagation(); cmd('closeTab', { id: t.id }); } }));
  if (t.groupId) {
    const g = S.groups.find((x) => x.id === t.groupId);
    if (g) el.append(h('div', { class: 'ingroup', style: { background: g.color } }));
  }
  // drag & drop
  el.addEventListener('dragstart', (e) => { dragging = true; e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; });
  el.addEventListener('dragend', (e) => { if (e.dataTransfer.dropEffect === 'none') cmd('detachTab', { id: t.id }); dragging = false; if (pendingRender) { pendingRender = false; render(); } });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const before = document.body.classList.contains('vertical') ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
    el.classList.toggle('dragover-before', before); el.classList.toggle('dragover-after', !before);
  });
  el.addEventListener('dragleave', () => el.classList.remove('dragover-before', 'dragover-after'));
  el.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain');
    const before = el.classList.contains('dragover-before');
    el.classList.remove('dragover-before', 'dragover-after');
    dragging = false;
    if (id && id !== t.id) {
      const list = S.tabs.filter((x) => x.id !== id);
      const i = list.findIndex((x) => x.id === t.id);
      const beforeId = before ? t.id : (list[i + 1]?.id || null);
      cmd('moveTab', { id, beforeId });
    }
  });
  return el;
}

// keyboard in the tab strip: arrows move between tabs, Enter/Space opens one, Delete closes it
let refocusTab = null;
function tabKey(e, t) {
  const all = [...document.querySelectorAll('#pins .tab, #tabs .tab')];
  const i = all.indexOf(e.currentTarget);
  const vertical = document.body.classList.contains('vertical');
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (step && (vertical ? /Up|Down/ : /Left|Right/).test(e.key)) {
    e.preventDefault();
    const next = all[(i + step + all.length) % all.length];
    all.forEach((x) => (x.tabIndex = -1)); next.tabIndex = 0; next.focus();
  } else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); const next = e.key === 'Home' ? all[0] : all[all.length - 1]; all.forEach((x) => (x.tabIndex = -1)); next.tabIndex = 0; next.focus(); }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cmd('activateTab', { id: t.id }); } // focus moves into the page, like clicking
  else if (e.key === 'Delete') { e.preventDefault(); refocusTab = (all[i + 1] || all[i - 1])?.dataset.id || null; cmd('closeTab', { id: t.id }); }
  else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); cmd('tabMenu', { id: t.id }); }
}

function renderTabs() {
  const pins = $('#pins'); const tabs = $('#tabs');
  pins.innerHTML = ''; tabs.innerHTML = '';
  const normal = S.tabs.filter((t) => !t.pinned);
  S.tabs.filter((t) => t.pinned).forEach((t) => pins.append(tabEl(t, { pin: true })));
  const compact = normal.length > 12 && !document.body.classList.contains('vertical');
  let lastGroup = null;
  for (const t of normal) {
    if (t.groupId !== lastGroup) {
      lastGroup = t.groupId;
      const g = S.groups.find((x) => x.id === t.groupId);
      if (g) {
        const count = normal.filter((x) => x.groupId === g.id).length;
        const chip = h('div', {
          class: 'gchip' + (g.collapsed ? ' collapsed' : ''), style: { background: g.color }, 'data-gid': g.id,
          title: g.collapsed ? 'Expand group' : 'Collapse group',
          onclick: () => cmd('toggleGroup', { id: g.id }),
          oncontextmenu: (e) => { e.preventDefault(); cmd('groupMenu', { id: g.id }); },
          ondblclick: (e) => openPanel('grename:' + g.id, e.currentTarget, 'left'),
        }, h('span', {}, g.name || (g.collapsed ? `${count} tabs` : '•')));
        chip.addEventListener('dragover', (e) => e.preventDefault());
        chip.addEventListener('drop', (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); dragging = false; if (id) cmd('addToGroup', { tabId: id, groupId: g.id }); });
        tabs.append(chip);
      }
    }
    const g = S.groups.find((x) => x.id === t.groupId);
    if (g && g.collapsed && t.id !== S.activeTabId) continue;
    tabs.append(tabEl(t, { compact }));
  }
  S.tabs.forEach((t) => seenTabs.add(t.id));
  lastActiveId = S.activeTabId;
  // the strip is rebuilt on every change; keep keyboard focus on the tab the user was on
  if (refocusTab) { const el = document.querySelector(`.tab[data-id="${refocusTab}"]`); refocusTab = null; if (el) { document.querySelectorAll('.tab').forEach((x) => (x.tabIndex = -1)); el.tabIndex = 0; el.focus(); } }
  $('#tabs').setAttribute('aria-orientation', document.body.classList.contains('vertical') ? 'vertical' : 'horizontal');
  pins.ondragover = (e) => e.preventDefault();
  pins.ondrop = (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); dragging = false; if (id) cmd('pinTab', { id, pinned: true }); };
  tabs.ondragover = (e) => e.preventDefault();
  tabs.ondrop = (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); dragging = false; if (id) { const t = S.tabs.find((x) => x.id === id); if (t?.pinned) cmd('pinTab', { id, pinned: false }); else cmd('moveTab', { id, beforeId: null }); } };
}

function renderToolbar() {
  const at = S.tabs.find((t) => t.id === S.activeTabId);
  $('#back').disabled = !at?.canGoBack; $('#fwd').disabled = !at?.canGoForward;
  $('#reload').innerHTML = icon(at?.loading ? 'x' : 'reload');
  $('#reload').title = at?.loading ? 'Stop' : 'Reload';
  const url = at?.url || '';
  const omniEl = $('#omniInput');
  const typing = omniDirty && document.hasFocus() && document.activeElement === omniEl;
  if (!typing && omniEl.value !== nice(url)) omniEl.value = nice(url);
  const sec = $('#secIcon');
  sec.className = (!url ? '' : (S.secure ? '' : 'warn')) + (panel?.name === 'site' ? ' on' : '');
  sec.innerHTML = !url ? icon('search') : S.secure ? icon('lock') : icon('warn');
  sec.disabled = !url;
  sec.title = !url ? '' : S.secure ? 'Connection is secure: site information' : 'Not secure: site information';
  sec.setAttribute('aria-label', sec.title || 'Search');
  renderDownloadsBtn();
  $('#star').classList.toggle('on', !!S.bookmarked);
  $('#star').style.display = url ? '' : 'none';
  const sh = $('#shield');
  const on = S.settings.adblock && S.siteBlocking !== false;
  sh.style.display = url ? '' : 'none';
  sh.className = 'chip' + (on ? ' hot' : '') + (panel?.name === 'shield' ? ' on' : '');
  sh.innerHTML = icon(on ? 'shieldCheck' : 'shield') + (on && at?.blocked ? `<span>${at.blocked > 999 ? '999+' : at.blocked}</span>` : '');
  const menuOpen = panel && ['menu', 'settings'].includes(panel.name) || panel?.name?.startsWith('library');
  $('#menu').classList.toggle('on', !!menuOpen);
  $('#menu').classList.toggle('dot', S.update?.status === 'ready' || !!S.whatsNew);
  $('#menu').title = S.update?.status === 'ready' ? 'Menu (update ready)' : S.whatsNew ? 'Menu (see what’s new)' : 'Menu';
  $('#menu').setAttribute('aria-label', $('#menu').title);
  renderMiniPlayer();
}

// downloads button: shows up once something has been downloaded, with a ring for overall progress
function renderDownloadsBtn() {
  const b = $('#dl');
  const list = S.downloads || [];
  b.hidden = !list.length;
  if (!list.length) return;
  const running = list.filter((d) => d.state === 'progressing');
  const warn = list.some((d) => d.state === 'warning');
  const total = running.reduce((a, d) => a + (d.total || 0), 0), got = running.reduce((a, d) => a + (d.received || 0), 0);
  const pct = running.length && total ? got / total : running.length ? 0.15 : 0;
  b.classList.toggle('on', panel?.name === 'downloads');
  b.classList.toggle('dot', warn);
  b.innerHTML = icon('download') + (running.length ? `<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" pathLength="100" stroke-dasharray="${Math.round(pct * 100)} 100"/></svg>` : '');
  const label = warn ? 'Downloads: a file needs your OK' : running.length ? `Downloads: ${running.length} in progress` : 'Downloads';
  b.title = label; b.setAttribute('aria-label', label);
}

// minimised music player: compact controls right of the search bar
function renderMiniPlayer() {
  const el = $('#mini');
  const sp = S.spotify?.connected ? S.spotify : null, m = S.media || {};
  const on = S.settings.mediaDock && S.settings.musicMode === 'mini';
  el.hidden = !on;
  if (!on) return;
  const title = sp ? sp.title : m.ok ? m.title : '', artist = sp ? sp.artist : m.ok ? m.artist : '';
  const playing = sp ? sp.playing : !!m.playing;
  const run = (action) => (sp ? cmd('spotify', { action }) : cmd('mediaCmd', { action }));
  el.innerHTML = '';
  el.append(
    (sp ? sp.art : m.art) ? h('img', { src: sp ? sp.art : m.art, alt: '' }) : h('i', { html: icon('music') }),
    h('div', { class: 'mt', title: title ? `${title} — ${artist}` : 'Nothing playing' }, title || 'Nothing playing'),
    h('button', { class: 'ib sm', title: 'Previous', onclick: () => run('prev'), html: icon('prev') }),
    h('button', { class: 'ib sm', title: playing ? 'Pause' : 'Play', onclick: () => run('toggle'), html: icon(playing ? 'pause' : 'play') }),
    h('button', { class: 'ib sm', title: 'Next', onclick: () => run('next'), html: icon('next') }),
    h('button', { class: 'ib sm', title: 'Expand', onclick: () => cmd('musicMode', { mode: 'open' }), html: icon('expand') }),
    h('button', { class: 'ib sm', title: 'Close', onclick: () => cmd('musicMode', { mode: 'closed' }), html: icon('x') }),
  );
}

function renderBookmarksBar() {
  const bar = $('#bmbar');
  bar.innerHTML = '';
  if (!S.settings.bookmarksBar) return;
  const root = BM.filter((b) => !b.folder);
  const folders = [...new Set(BM.filter((b) => b.folder).map((b) => b.folder.split('/')[0]))];
  folders.forEach((f) => {
    bar.append(h('button', { class: 'bm', onclick: (e) => togglePanel('folder:' + f, e.currentTarget, 'left') }, h('span', { html: icon('folder') }), h('span', {}, f), h('span', { html: icon('chev') })));
  });
  root.forEach((b) => bar.append(h('button', {
    class: 'bm', title: b.title + '\n' + b.url,
    onclick: () => cmd('openUrl', { url: b.url }),
    onauxclick: (e) => { if (e.button === 1) cmd('openUrl', { url: b.url, newTab: true }); },
    oncontextmenu: (e) => { e.preventDefault(); cmd('removeBookmark', { id: b.id }); },
  }, h('span', { class: 'ini', style: { background: colorOf(hostname(b.url)) } }, initial(hostname(b.url) || b.title)), h('span', {}, b.title))));
  if (!root.length && !folders.length) bar.append(h('span', { class: 'bmhint' }, 'No bookmarks yet'));
}

// ───────────────────────────────────────────── panels
function togglePanel(name, anchor, align) {
  if (panel && panel.name === name) return closePanel();
  openPanel(name, anchor, align);
}
function openPanel(name, anchor, align = 'right') {
  const same = panel;
  panel = { name, anchor, align };
  if (name === 'library:history') cmd('getHistory').then((h2) => { histCache = h2 || []; if (panel?.name === 'library:history') renderPanel(); });
  if (name === 'site') { siteCache = null; cmd('siteInfo').then((r) => { siteCache = r; if (panel?.name === 'site') renderPanel(); }); }
  if (name === 'memory') loadMemory();
  if (!same) cmd('setOverlay', { open: true });
  renderPanel(); renderWorkspaceBtn(); renderToolbar();
  // keyboard users land inside the panel (the address bar keeps focus for suggestions and find has its own input)
  if (!['suggest', 'find'].includes(name) && !$('#panel').contains(document.activeElement)) $('#panel').focus({ preventScroll: true });
}
let siteCache = null, memCache = null, memTimer = null;
function loadMemory() {
  clearTimeout(memTimer);
  cmd('tabMemory').then((r) => {
    memCache = r;
    if (panel?.name !== 'memory') return;
    renderPanel();
    memTimer = setTimeout(loadMemory, 3000);
  });
}
function closePanel() {
  if (!panel) return;
  panel = null; wsEdit = null;
  $('#panel').innerHTML = '';
  cmd('setOverlay', { open: false });
  renderWorkspaceBtn(); renderToolbar();
}

function placePanel(el) {
  const a = panel.anchor; const top = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chrome-h')) || 84;
  el.style.top = '6px'; el.style.left = el.style.right = 'auto';
  if (!a) { el.style.right = '10px'; return; }
  const r = a.getBoundingClientRect();
  if (panel.align === 'left') el.style.left = Math.max(8, r.left) + 'px';
  else if (panel.align === 'omni') { el.style.left = r.left + 'px'; el.style.width = r.width + 'px'; el.style.maxWidth = 'none'; }
  else el.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  el.style.top = Math.max(6, (r.bottom - top) + 8) + 'px';
  if (panel.align === 'omni' && document.body.classList.contains('vertical')) el.style.width = Math.max(r.width, 380) + 'px';
  // keep the panel on screen (matters for sidebars)
  const box = el.getBoundingClientRect();
  if (box.right > innerWidth - 8) { el.style.left = 'auto'; el.style.right = '8px'; }
  if (box.left < 8) { el.style.right = 'auto'; el.style.left = '8px'; }
}

function renderPanel() {
  const el = $('#panel');
  const keepScroll = el.scrollTop;
  const keepFocus = document.activeElement && el.contains(document.activeElement) ? document.activeElement.id : null;
  el.innerHTML = ''; el.style.width = ''; el.style.maxWidth = '';
  const n = panel.name;
  if (n === 'menu') panelMenu(el);
  else if (n === 'settings') panelSettings(el);
  else if (n === 'shield') panelShield(el);
  else if (n === 'ws') panelWorkspaces(el);
  else if (n.startsWith('library')) panelLibrary(el);
  else if (n.startsWith('folder:')) panelFolder(el, n.slice(7));
  else if (n === 'find') panelFind(el);
  else if (n.startsWith('grename:')) panelGroupRename(el, n.slice(8));
  else if (n === 'suggest') panelSuggest(el);
  else if (n === 'downloads') panelDownloads(el);
  else if (n === 'site') panelSite(el);
  else if (n === 'memory') panelMemory(el);
  else if (n === 'whatsnew') panelWhatsNew(el);
  el.setAttribute('role', n === 'suggest' ? 'listbox' : 'dialog');
  el.setAttribute('aria-label', PANEL_NAMES[n] || (n.startsWith('library') ? 'Library' : n.startsWith('folder:') ? n.slice(7) : 'Panel'));
  placePanel(el);
  el.scrollTop = keepScroll;
  if (keepFocus) { const f = document.getElementById(keepFocus); if (f) { f.focus(); if (f.setSelectionRange && f.value != null) f.setSelectionRange(f.value.length, f.value.length); } }
}

const toggle = (on, onclick) => h('div', { class: 'sw' + (on ? ' on' : ''), onclick });
function setRow(label, sub, key, invert) {
  const val = S.settings[key];
  return h('div', { class: 'row click', role: 'switch', 'aria-checked': String(invert ? !val : !!val), 'aria-label': label, onclick: () => cmd('setSetting', { key, value: !val }) },
    h('div', { class: 'grow' }, h('div', { class: 't' }, label), sub ? h('div', { class: 'sub' }, sub) : null), toggle(invert ? !val : val));
}

function menuItem(ic, label, onclick, kbd, cls) {
  return h('button', { class: 'mi' + (cls ? ' ' + cls : ''), onclick },
    h('i', { html: icon(ic), style: { display: 'grid' } }), h('span', {}, label), kbd ? h('kbd', {}, kbd) : null);
}

function panelMenu(el) {
  el.style.width = '250px';
  const sub = (name) => openPanel(name, $('#menu'), 'right');
  if (S.update?.status === 'ready') el.append(menuItem('update', `Restart to update to ${S.update.version}`, () => cmd('installUpdate'), null, 'hi'), h('div', { class: 'sep' }));
  if (S.whatsNew) el.append(menuItem('sparkle', `What’s new in ${S.whatsNew.version}`, () => sub('whatsnew'), null, 'hi'), h('div', { class: 'sep' }));
  el.append(
    menuItem('newtab', 'New tab', () => { closePanel(); cmd('newTab'); }, 'Ctrl+T'),
    menuItem('mask', 'New private tab', () => { closePanel(); cmd('newTab', { private: true }); }, 'Ctrl+⇧+N'),
    menuItem('star', 'Bookmarks', () => sub('library:bookmarks'), 'Ctrl+⇧+O'),
    menuItem('clock', 'History', () => sub('library:history'), 'Ctrl+H'),
    menuItem('download', 'Downloads', () => sub('downloads'), 'Ctrl+J'),
    menuItem('cpu', 'Tabs and memory', () => sub('memory')),
    menuItem('find', 'Find on page', () => { findInfo = { text: findInfo.text, active: 0, matches: 0 }; openPanel('find', null, 'right'); }, 'Ctrl+F'),
    menuItem('pip', 'Pop out video', () => { closePanel(); cmd('pip'); }, 'Alt+P'),
    menuItem('external', 'Open in default browser', () => { closePanel(); cmd('openExternal', {}); }),
    menuItem('music', 'Music player', () => { closePanel(); cmd('musicMode', { mode: 'open' }); }),
    h('div', { class: 'sep' }),
    menuItem('gear', 'Settings', () => sub('settings'), 'Ctrl+,'),
    menuItem('puzzle', 'Extensions', () => { menuTab = 'ext'; sub('settings'); }),
    menuItem('find', 'Keyboard shortcuts', () => { menuTab = 'keys'; sub('settings'); }, 'Ctrl+/'),
    h('div', { class: 'sep' }),
    menuItem('power', 'Quit', () => cmd('quit'), null, 'danger'),
  );
}

const THEME_PREVIEW = {
  ink: ['#181818', '#f2f2f2'], graphite: ['#232323', '#a3a3a3'], mono: ['#000', '#fff'],
  smoke: ['#e9e9e9', '#555'], chalk: ['#ffffff', '#181818'],
};

function segRow(label, key, options) {
  return h('div', { class: 'row' }, h('div', { class: 'grow' }, label),
    h('div', { class: 'seg inline' }, options.map(([v, l]) => h('button', { class: S.settings[key] === v ? 'on' : '', onclick: () => cmd('setSetting', { key, value: v }) }, l))));
}

function updateBlock() {
  const u = S.update || { status: 'idle' };
  const text = {
    unsupported: 'Updates work in the installed app',
    idle: 'Up to date', none: 'You have the latest version', checking: 'Checking for updates…',
    available: `Found ${u.version}`, downloading: `Downloading ${u.version}… ${Math.round(u.progress || 0)}%`,
    ready: `${u.version} is ready to install`, error: 'Couldn’t check for updates',
  }[u.status] || '';
  const btn = u.status === 'ready'
    ? h('button', { class: 'btn pri', onclick: () => cmd('installUpdate') }, 'Restart')
    : h('button', { class: 'btn', disabled: ['checking', 'downloading', 'unsupported'].includes(u.status), onclick: () => cmd('checkUpdates') }, 'Check');
  return h('div', { class: 'upd' },
    h('div', { class: 'grow' }, h('div', {}, `opentab ${S.version}`), h('div', { class: 'note', style: { padding: 0 } }, text),
      u.status === 'downloading' ? h('div', { class: 'bar' }, h('i', { style: { transform: `scaleX(${(u.progress || 0) / 100})` } })) : null),
    btn);
}

function selectRow(label, key, options, numeric) {
  return h('div', { class: 'row' }, h('div', { class: 'grow' }, label),
    h('select', { class: 'sel', onchange: (e) => cmd('setSetting', { key, value: numeric ? +e.target.value : e.target.value }) },
      options.map(([v, l]) => h('option', { value: v, selected: S.settings[key] === v }, l))));
}

function panelSettings(el) {
  const st = S.settings;
  el.style.width = '400px';
  const tabs = [['general', 'General'], ['look', 'Look'], ['privacy', 'Privacy'], ['sync', 'Sync'], ['side', 'Sidebar'], ['ext', 'Add-ons'], ['keys', 'Keys']];
  if (!tabs.some(([k]) => k === menuTab)) menuTab = 'general';
  el.append(h('div', { class: 'seg tight', role: 'tablist', 'aria-label': 'Settings sections' }, tabs.map(([k, l]) => h('button', { class: menuTab === k ? 'on' : '', role: 'tab', 'aria-selected': String(menuTab === k), onclick: () => { menuTab = k; renderPanel(); } }, l))));

  if (menuTab === 'side') {
    el.append(h('div', { class: 'sec' }, 'Sidebar'));
    el.append(segRow('Position', 'sidebar', [['left', 'Left'], ['right', 'Right'], ['off', 'Off']]));
    el.append(segRow('Panels open as', 'sidebarMode', [['overlay', 'Overlay'], ['docked', 'Docked']]));
    el.append(segRow('Panel width', 'panelWidth', [[320, 'Narrow'], [380, 'Normal'], [480, 'Wide']]));
    el.append(h('div', { class: 'row click', onclick: () => { closePanel(); cmd('setEditMode', { on: true }); } }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Edit layout'), h('div', { class: 'sub' }, 'Drag toolbar buttons, the sidebar and corner controls'))));
    el.append(h('div', { class: 'sec' }, 'Connections'));
    const conn = (app, name, sub, on) => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, name), h('div', { class: 'sub' }, sub)),
      h('button', { class: 'btn' + (on ? '' : ' pri'), onclick: () => cmd('connect', { app }) }, on ? 'Disconnect' : 'Connect'));
    el.append(conn('spotify', 'Music player', 'Spotify controls in the bottom-right corner', st.mediaDock));
    if (st.mediaDock) {
      el.append(segRow('Music player', 'musicMode', [['open', 'Corner'], ['mini', 'Toolbar'], ['closed', 'Hidden']]));
      el.append(h('div', { class: 'row click', onclick: () => cmd('spotify', { action: S.spotify?.connected ? 'disconnect' : 'connect' }) },
        h('div', { class: 'grow' }, h('div', { class: 't' }, S.spotify?.connected ? 'Signed in to Spotify' : 'Sign in with Spotify'), h('div', { class: 'sub' }, S.spotify?.error || (S.spotify?.connected ? 'Click to sign out' : 'Adds search, playlists, likes, seek and volume'))),
        h('button', { class: 'btn' + (S.spotify?.connected ? '' : ' pri') }, S.spotify?.connected ? 'Sign out' : 'Sign in')));
    }
    el.append(setRow('Notifications', 'Allow websites to show desktop notifications', 'notifications'));
  } else if (menuTab === 'ext') {
    el.append(h('div', { class: 'note', style: { paddingTop: '10px' } }, 'Load an unpacked Chrome extension: a folder with a manifest.json. You can get one by downloading the extension’s source, or by unzipping a .crx file. Extensions that work on pages (content blockers, dark mode, page tweaks) run fine. Toolbar buttons and popups aren’t supported yet.'));
    const list = S.extensions || [];
    if (!list.length) el.append(h('div', { class: 'empty' }, 'No extensions'));
    list.forEach((x) => el.append(h('div', { class: 'row' }, h('span', { class: 'dl-ic', html: icon('puzzle') }),
      h('div', { class: 'grow' }, h('div', { class: 't' }, x.name + (x.version ? ' ' + x.version : '')), h('div', { class: 'sub' + (x.error ? ' warn-t' : '') }, x.error || x.path)),
      h('button', { class: 'btn sm', onclick: () => cmd('removeExtension', { path: x.path }) }, 'Remove'))));
    el.append(h('div', { class: 'btns' }, h('button', { class: 'btn pri', onclick: () => cmd('addExtension') }, 'Load unpacked…')));
    el.append(h('div', { class: 'note' }, 'Extensions don’t run in private tabs.'));
  } else if (menuTab === 'keys') {
    SHORTCUTS.forEach(([sec, rows]) => {
      el.append(h('div', { class: 'sec' }, sec));
      rows.forEach(([keys, what]) => el.append(h('div', { class: 'row keyrow' }, h('div', { class: 'grow' }, what), h('kbd', {}, keys))));
    });
  } else if (menuTab === 'look') {
    el.append(h('div', { class: 'sec' }, 'Theme'));
    const grid = h('div', { class: 'themes' });
    S.themes.forEach((t) => {
      const p = t === 'custom' && S.custom ? [S.custom.bg, S.custom.fg] : THEME_PREVIEW[t] || THEME_PREVIEW.ink;
      grid.append(h('button', { class: 'theme' + (st.theme === t ? ' on' : ''), title: t[0].toUpperCase() + t.slice(1), style: { background: p[0] }, onclick: () => cmd('setSetting', { key: 'theme', value: t }) },
        h('i', { style: { background: p[1] } })));
    });
    el.append(grid);
    // custom theme: pick the window and text colours; the rest of the palette is mixed from them
    const colorRow = (label, key) => {
      const inp = h('input', { type: 'color', class: 'accent pick', value: st[key] });
      inp.addEventListener('change', () => cmd('setSetting', { key, value: inp.value }));
      return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, label)), inp);
    };
    el.append(h('div', { class: 'sec' }, 'Custom colors'), colorRow('Window', 'customBg'), colorRow('Text', 'customFg'));
    el.append(h('div', { class: 'sec' }, 'Accent'));
    const ac = h('div', { class: 'accents' });
    ac.append(h('button', { class: 'accent auto' + (st.accent === 'auto' ? ' on' : ''), title: 'Match theme', onclick: () => cmd('setSetting', { key: 'accent', value: 'auto' }) }));
    ACCENTS.forEach((c) => ac.append(h('button', { class: 'accent' + (st.accent.toLowerCase() === c ? ' on' : ''), style: { background: c }, onclick: () => cmd('setSetting', { key: 'accent', value: c }) })));
    const pick = h('input', { type: 'color', class: 'accent pick', value: st.accent === 'auto' ? '#ffffff' : st.accent, title: 'Any color' });
    pick.addEventListener('change', () => cmd('setSetting', { key: 'accent', value: pick.value }));
    ac.append(pick); el.append(ac);

    el.append(h('div', { class: 'sec' }, 'New tab background'));
    const bg = h('div', { class: 'accents' });
    const bgOn = (v) => (st.ntBackground === v ? ' on' : '');
    const setBg = (v) => cmd('setSetting', { key: 'ntBackground', value: v });
    bg.append(h('button', { class: 'accent auto' + bgOn('theme'), title: 'Match theme', onclick: () => setBg('theme') }));
    BACKGROUNDS.forEach((c) => bg.append(h('button', { class: 'accent' + bgOn(c), style: { background: c }, onclick: () => setBg(c) })));
    Object.entries(GRADIENTS).forEach(([k, g]) => bg.append(h('button', { class: 'accent' + bgOn('grad:' + k), title: k[0].toUpperCase() + k.slice(1), style: { background: g }, onclick: () => setBg('grad:' + k) })));
    const bgPick = h('input', { type: 'color', class: 'accent pick', value: /^#/.test(st.ntBackground) ? st.ntBackground : '#181818', title: 'Any color' });
    bgPick.addEventListener('change', () => setBg(bgPick.value));
    bg.append(bgPick); el.append(bg);
    el.append(h('div', { class: 'row click', onclick: () => cmd('pickBackground') }, h('div', { class: 'grow' }, h('div', { class: 't' }, st.ntBackground === 'image' ? 'Change image' : 'Use an image'), h('div', { class: 'sub' }, 'Pick a photo from your PC — colors are matched to it automatically'))));
    if (st.ntBackground === 'image') {
      el.append(h('div', { class: 'row click', onclick: () => cmd('matchColors') }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Match colors to image'), h('div', { class: 'sub' }, 'Set the window, text and accent colors from your background'))));
      el.append(segRow('Dim image', 'ntDim', [[0, 'Off'], [30, 'Some'], [55, 'More']]));
    }
    el.append(setRow('Clock', null, 'ntClock'), setRow('Logo', null, 'ntLogo'), setRow('Shortcuts', 'Bookmarks under the search box', 'ntShortcuts'));
    el.append(h('div', { class: 'sec' }, 'Layout'));
    el.append(segRow('Tabs', 'tabPosition', [['top', 'Top'], ['left', 'Left'], ['right', 'Right']]));
    if (st.tabPosition !== 'top') el.append(segRow('Sidebar', 'sideWidth', [[200, 'Slim'], [240, 'Normal'], [300, 'Wide']]));
    el.append(segRow('Density', 'density', [['compact', 'Compact'], ['comfy', 'Comfy'], ['roomy', 'Roomy']]));
    el.append(segRow('Corners', 'corners', [['square', 'Square'], ['soft', 'Soft'], ['round', 'Round']]));
    el.append(setRow('Workspaces', 'Separate sets of tabs', 'workspaces'));
    el.append(segRow('Font', 'font', [['sans', 'Instrument'], ['system', 'System']]));
    el.append(h('div', { class: 'sep' }));
    if (st.tabPosition === 'top') el.append(setRow('Bookmarks bar', null, 'bookmarksBar'));
  } else if (menuTab === 'privacy') {
    el.append(h('div', { class: 'big' }, h('b', {}, S.settings.totalBlocked.toLocaleString()), h('span', {}, 'trackers blocked')));
    el.append(setRow('Block ads & trackers', null, 'adblock'));
    el.append(setRow('Hide empty ad spaces', null, 'cosmetic'));
    el.append(setRow('Clean tracking links', null, 'stripParams'));
    el.append(setRow('Do Not Track', null, 'sendGpc'));
    el.append(h('div', { class: 'sec' }, 'Filter lists'));
    el.append(segRow('Blocking', 'filterLevel', [['standard', 'Standard'], ['strict', 'Strict']]));
    const al = S.adLists || {};
    el.append(h('div', { class: 'note' }, st.filterLevel === 'strict'
      ? 'Ads, trackers, plus annoyances (pop-ups, newsletter boxes) and cookie banners. Can occasionally break a site: turn it off for that site with the shield.'
      : 'Ads and trackers (EasyList, EasyPrivacy, uBlock filters, Peter Lowe’s list).'));
    el.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'Lists updated'),
      h('div', { class: 'sub' }, { updating: 'Updating…', error: 'Couldn’t download the lists. Using the built-in list.', unavailable: 'Using the built-in list' }[al.status] || (al.updated ? new Date(al.updated).toLocaleString() + ' · refreshes weekly' : '—'))),
      h('button', { class: 'btn sm', disabled: al.status === 'updating' || al.status === 'unavailable', onclick: () => cmd('updateFilters') }, 'Update now')));
    if (S.sitePerms?.length) {
      el.append(h('div', { class: 'sec' }, 'Site permissions'));
      S.sitePerms.forEach((p) => el.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, p.origin.replace(/^https?:\/\//, '')), h('div', { class: 'sub' }, `${p.label}: ${p.allow ? 'allowed' : 'blocked'}`)),
        h('button', { class: 'xbtn', style: { opacity: 1 }, title: 'Forget this choice', html: icon('x'), onclick: () => cmd('forgetPermission', { key: p.key }) }))));
    }
    if (st.allowlist.length) {
      el.append(h('div', { class: 'sec' }, 'Allowed sites'));
      st.allowlist.forEach((s) => el.append(h('div', { class: 'row' }, h('div', { class: 'grow t' }, s),
        h('button', { class: 'xbtn', style: { opacity: 1 }, title: 'Block again', html: icon('x'), onclick: () => cmd('siteBlock', { site: s, enabled: true }) }))));
    }
    el.append(h('div', { class: 'sec' }, 'Clear'));
    el.append(h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: () => cmd('clearData', { history: true }) }, 'History'),
      h('button', { class: 'btn', onclick: () => cmd('clearData', { site: true }) }, 'Cookies'),
      h('button', { class: 'btn danger', onclick: () => cmd('clearData', { history: true, site: true, permissions: true, counter: true }) }, 'Everything')));
  } else if (menuTab === 'sync') {
    el.append(h('div', { class: 'sec' }, 'Bookmarks from'));
    [['chrome', 'Chrome'], ['edge', 'Edge'], ['brave', 'Brave'], ['opera', 'Opera']].forEach(([k, l]) => {
      const on = st.syncSources.includes(k);
      el.append(h('div', { class: 'row click', onclick: () => cmd('setSetting', { key: 'syncSources', value: on ? st.syncSources.filter((x) => x !== k) : [...st.syncSources, k] }) }, h('div', { class: 'grow' }, l), toggle(on)));
    });
    el.append(h('div', { class: 'sep' }), setRow('Auto sync', null, 'autoSync'));
    el.append(h('div', { class: 'btns' },
      h('button', { class: 'btn pri', onclick: () => cmd('syncNow') }, 'Sync now'),
      h('button', { class: 'btn', onclick: () => cmd('importHTML') }, 'Import'),
      h('button', { class: 'btn', onclick: () => cmd('exportHTML') }, 'Export')));
    if (st.lastSync) el.append(h('div', { class: 'note' }, 'Last synced ' + new Date(st.lastSync).toLocaleString()));
  } else {
    el.append(selectRow('Search engine', 'searchEngine', Object.entries(S.engines)));
    el.append(selectRow('Sleep idle tabs', 'sleepMinutes', [[0, 'Never'], [10, '10 min'], [20, '20 min'], [30, '30 min'], [60, '1 hour']], true));
    el.append(setRow('Notifications', null, 'notifications'));
    el.append(setRow('Run in background', null, 'runInBackground'));
    el.append(setRow('Low power mode', 'Needs restart', 'lowPowerMode'));
    el.append(h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: () => cmd('setDefault') }, 'Set as default'),
      h('button', { class: 'btn', onclick: () => { closePanel(); cmd('devtools'); } }, 'Dev tools')));
    el.append(h('div', { class: 'sec' }, 'Updates'), updateBlock(), setRow('Update automatically', 'Downloads in the background, installs when you restart', 'autoUpdate'));
    el.append(h('div', { class: 'sec' }, 'Your info'));
    const tl = S.telemetry || {};
    const idRow = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'User ID'), h('div', { class: 'sub mono' }, S.userId || '—')),
      h('button', { class: 'btn', onclick: () => cmd('copyText', { text: S.userId || '' }) }, 'Copy'));
    el.append(idRow);
    el.append(h('div', { class: 'note' }, 'opentab reports this ID with your app version, platform (' + (tl.platform || '') + ' ' + (tl.osVersion || '') + '), basic hardware details, a scrambled (hashed) device name and your IP address, as described in the Privacy Policy (policies.opentab.cc/privacy). It does not send your browsing history, files or passwords.'));
    el.append(setRow('Send crash reports', 'Off unless you turn it on', 'crashReports'));
    el.append(h('div', { class: 'note' }, 'When something in opentab breaks, send what failed, where in opentab’s code, and your app and Windows version. Never the pages you were on or anything you typed.'));
  }
}

function panelShield(el) {
  const at = S.tabs.find((t) => t.id === S.activeTabId);
  const on = S.settings.adblock && S.siteBlocking !== false;
  el.style.width = '280px';
  el.append(h('div', { class: 'ph' }, h('span', {}, 'Shield'), h('small', {}, S.site)));
  el.append(h('div', { class: 'big' }, h('b', {}, String(on ? at?.blocked || 0 : 0)), h('span', {}, 'blocked here')));
  if (!S.settings.adblock) {
    el.append(h('div', { class: 'row click', onclick: () => cmd('setSetting', { key: 'adblock', value: true }) }, h('div', { class: 'grow' }, 'Shield'), toggle(false)));
  } else if (S.site) {
    el.append(h('div', { class: 'row click', role: 'switch', 'aria-checked': String(S.siteBlocking !== false), onclick: () => cmd('siteBlock', { site: S.site, enabled: S.siteBlocking === false }) },
      h('div', { class: 'grow' }, 'On for this site'), toggle(S.siteBlocking !== false)));
  }
  // what was blocked on this page, busiest first
  if (on && S.blockedHosts?.length) {
    el.append(h('div', { class: 'sec' }, 'Blocked on this page'));
    S.blockedHosts.forEach(([host, n]) => el.append(h('div', { class: 'row tight' }, h('div', { class: 'grow t mono-t' }, host), h('span', { class: 'cnt' }, String(n)))));
  }
}

function panelDownloads(el) {
  el.style.width = '380px';
  const list = S.downloads || [];
  el.append(h('div', { class: 'ph' }, h('span', {}, 'Downloads'),
    h('div', { style: { display: 'flex', gap: '4px' } },
      h('button', { class: 'btn sm', onclick: () => cmd('openDownloadsFolder') }, 'Open folder'),
      list.some((d) => !['progressing', 'warning'].includes(d.state)) ? h('button', { class: 'btn sm', onclick: () => cmd('clearDownloads') }, 'Clear') : null)));
  if (!list.length) el.append(h('div', { class: 'empty' }, 'Nothing downloaded yet'));
  const act = (d, action) => cmd('download', { id: d.id, action });
  list.forEach((d) => {
    const pct = d.total ? Math.min(100, Math.round((d.received / d.total) * 100)) : 0;
    let sub, buttons = [];
    if (d.state === 'warning') {
      sub = h('div', { class: 'sub warn-t' }, 'This kind of file can run programs on your PC. Only keep it if you trust where it came from.');
      buttons = [h('button', { class: 'btn sm danger', onclick: () => act(d, 'discard') }, 'Discard'), h('button', { class: 'btn sm', onclick: () => act(d, 'keep') }, 'Keep')];
    } else if (d.state === 'progressing') {
      sub = h('div', {}, h('div', { class: 'sub' }, d.paused ? `Paused · ${fmtBytes(d.received)}${d.total ? ' of ' + fmtBytes(d.total) : ''}` : `${fmtBytes(d.received)}${d.total ? ' of ' + fmtBytes(d.total) : ''}`),
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: { transform: `scaleX(${d.total ? pct / 100 : 0.1})` } })));
      buttons = [h('button', { class: 'ib sm', title: d.paused ? 'Resume' : 'Pause', html: icon(d.paused ? 'playSm' : 'pauseSm'), onclick: () => act(d, d.paused ? 'resume' : 'pause') }),
        h('button', { class: 'ib sm', title: 'Cancel', html: icon('x'), onclick: () => act(d, 'cancel') })];
    } else if (d.state === 'completed') {
      sub = h('div', { class: 'sub' }, fmtBytes(d.received) + (d.private ? ' · private' : ''));
      buttons = [h('button', { class: 'ib sm', title: 'Show in folder', html: icon('folder'), onclick: () => act(d, 'show') }),
        h('button', { class: 'ib sm', title: 'Remove from list', html: icon('x'), onclick: () => act(d, 'remove') })];
    } else {
      sub = h('div', { class: 'sub' }, d.state === 'cancelled' ? 'Cancelled' : 'Failed');
      buttons = [h('button', { class: 'ib sm', title: 'Remove from list', html: icon('x'), onclick: () => act(d, 'remove') })];
    }
    const name = d.state === 'completed'
      ? h('button', { class: 't dl-name', title: 'Open ' + d.name, onclick: () => act(d, 'open') }, d.name)
      : h('div', { class: 't' }, d.name);
    el.append(h('div', { class: 'row dl' + (d.state === 'warning' ? ' warn' : '') + (['cancelled', 'interrupted'].includes(d.state) ? ' dim' : '') },
      h('span', { class: 'dl-ic', html: icon(d.state === 'warning' ? 'warn' : 'file') }),
      h('div', { class: 'grow' }, name, sub), ...buttons));
  });
}

function panelSite(el) {
  el.style.width = '330px';
  const s = siteCache;
  el.append(h('div', { class: 'ph' }, h('span', {}, S.site || 'Site'), s?.private ? h('small', {}, 'Private tab') : null));
  if (!s) { el.append(h('div', { class: 'empty' }, 'Loading…')); return; }
  el.append(h('div', { class: 'row' }, h('span', { class: 'si-ic' + (s.secure ? '' : ' warn'), html: icon(s.secure ? 'lock' : 'warn') }),
    h('div', { class: 'grow' }, h('div', { class: 't' }, s.secure ? 'Connection is secure' : 'Connection is not secure'),
      h('div', { class: 'sub' }, s.secure ? 'Information you send to this site is encrypted.' : 'Don’t enter passwords or card details on this site.'))));
  if (s.secure && s.cert) {
    el.append(h('details', { class: 'cert' }, h('summary', {}, h('span', { html: icon('info') }), 'Certificate'),
      h('div', { class: 'kv' },
        h('div', {}, h('span', {}, 'Issued to'), h('b', {}, s.cert.subject?.commonName || s.host)),
        h('div', {}, h('span', {}, 'Issued by'), h('b', {}, [s.cert.issuer?.organizations?.[0], s.cert.issuer?.commonName].filter(Boolean).join(' · ') || '—')),
        h('div', {}, h('span', {}, 'Valid'), h('b', {}, `${fmtDate(s.cert.validStart)} – ${fmtDate(s.cert.validExpiry)}`)),
        h('div', {}, h('span', {}, 'Fingerprint'), h('b', { class: 'mono' }, String(s.cert.fingerprint || '').replace(/^sha256\//, '').slice(0, 44))))));
  }
  el.append(h('div', { class: 'sep' }));
  const on = S.settings.adblock && S.siteBlocking !== false;
  el.append(h('div', { class: 'row click', role: 'switch', 'aria-checked': String(on), onclick: () => (S.settings.adblock ? cmd('siteBlock', { site: S.site, enabled: !on }) : cmd('setSetting', { key: 'adblock', value: true })) },
    h('div', { class: 'grow' }, h('div', { class: 't' }, 'Block ads and trackers here'), h('div', { class: 'sub' }, on ? `${S.tabs.find((t) => t.id === S.activeTabId)?.blocked || 0} blocked on this page` : 'Off for this site')), toggle(on)));
  el.append(h('div', { class: 'sec' }, 'Permissions'));
  if (!s.perms.length) el.append(h('div', { class: 'note' }, 'This site hasn’t asked for any permissions.'));
  s.perms.forEach((p) => el.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, p.label), h('div', { class: 'sub' }, p.allow ? 'Allowed' : 'Blocked')),
    h('button', { class: 'btn sm', onclick: () => { cmd('forgetPermission', { key: p.key }); s.perms = s.perms.filter((x) => x !== p); renderPanel(); } }, 'Reset'))));
  el.append(h('div', { class: 'sec' }, 'Data'));
  el.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, `${s.cookies} cookie${s.cookies === 1 ? '' : 's'}`), h('div', { class: 'sub' }, 'Clearing signs you out of this site')),
    h('button', { class: 'btn sm danger', onclick: () => { closePanel(); cmd('clearSiteData'); } }, 'Clear')));
}

function panelMemory(el) {
  el.style.width = '380px';
  const m = memCache;
  el.append(h('div', { class: 'ph' }, h('span', {}, 'Tabs and memory'), m ? h('small', {}, `opentab is using ${m.totalMb.toLocaleString()} MB`) : null));
  if (!m) { el.append(h('div', { class: 'empty' }, 'Measuring…')); return; }
  el.append(selectRow('Sleep idle tabs after', 'sleepMinutes', [[0, 'Never'], [5, '5 min'], [10, '10 min'], [20, '20 min'], [30, '30 min'], [60, '1 hour']], true));
  el.append(h('div', { class: 'note' }, 'Sleeping tabs use no memory. They reload when you open them. Pinned tabs and tabs playing audio stay awake.'));
  [...m.tabs].sort((a, b) => b.mb - a.mb).forEach((t) => el.append(h('div', { class: 'row' },
    h('span', { class: 'mini', style: { background: t.favicon ? 'transparent' : colorOf(hostname(t.url)) } }, t.favicon ? h('img', { src: t.favicon, style: { width: '16px', height: '16px' }, alt: '' }) : initial(hostname(t.url) || t.title)),
    h('div', { class: 'grow' }, h('div', { class: 't' }, t.title || 'Untitled'), h('div', { class: 'sub' }, t.sleeping ? 'Sleeping' : t.mb ? `${t.mb.toLocaleString()} MB` : 'Shares memory with another tab')),
    !t.sleeping && !t.active && !t.pinned ? h('button', { class: 'btn sm', onclick: () => { cmd('sleepTab', { id: t.id }); setTimeout(loadMemory, 300); } }, 'Sleep') : null)));
}

function panelWhatsNew(el) {
  el.style.width = '380px';
  const w = S.whatsNew;
  if (!w) return closePanel();
  el.append(h('div', { class: 'ph' }, h('span', {}, `What’s new in ${w.version}`)));
  el.append(h('div', { class: 'notes' }, w.text || 'This update has fixes and improvements.'));
  el.append(h('div', { class: 'btns' }, h('button', { class: 'btn pri', onclick: () => { cmd('dismissWhatsNew'); closePanel(); } }, 'Got it')));
}

function panelWorkspaces(el) {
  el.style.width = '280px';
  el.append(h('div', { class: 'ph' }, h('span', {}, 'Workspaces')));
  S.workspaces.forEach((w) => {
    if (wsEdit && wsEdit.id === w.id) return el.append(wsForm(w));
    el.append(h('div', { class: 'row click', onclick: () => { closePanel(); cmd('switchWorkspace', { id: w.id }); }, oncontextmenu: (e) => { e.preventDefault(); cmd('workspaceMenu', { id: w.id }); } },
      w.emoji ? h('span', { class: 'emoji' }, w.emoji) : h('span', { class: 'mini', style: { background: w.color } }, initial(w.name)),
      h('div', { class: 'grow' }, h('div', { class: 't' }, w.name), h('div', { class: 'sub' }, `${w.count} tab${w.count === 1 ? '' : 's'}`)),
      w.id === S.activeWorkspaceId ? h('span', { html: icon('check'), style: { color: 'var(--accent)' } }) : null));
  });
  if (wsEdit && wsEdit.create) el.append(wsForm(null));
  else el.append(h('div', { class: 'sep' }), menuItem('plus', 'New workspace', () => { wsEdit = { create: true }; renderPanel(); setTimeout(() => $('#wsName')?.focus(), 0); }));
}
function wsForm(w) {
  let emoji = w?.emoji || '';
  const name = h('input', { class: 'txt', id: 'wsName', value: w?.name || '', placeholder: 'Name', style: { flex: '1' }, maxlength: '24' });
  const save = () => {
    const n = name.value.trim() || 'Workspace';
    if (w) cmd('renameWorkspace', { id: w.id, name: n, emoji }); else { closePanel(); cmd('createWorkspace', { name: n, emoji }); return; }
    wsEdit = null; renderPanel();
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { wsEdit = null; renderPanel(); e.stopPropagation(); } });
  const em = h('div', { class: 'accents' }, ['', ...EMOJIS].map((e) => h('div', { class: 'accent', style: { background: 'var(--input)', fontSize: '13px', display: 'grid', placeItems: 'center', borderColor: e === emoji ? 'var(--fg)' : 'transparent' }, onclick: (ev) => { emoji = e; [...em.children].forEach((c) => (c.style.borderColor = 'transparent')); ev.currentTarget.style.borderColor = 'var(--fg)'; } }, e || '•')));
  return h('div', { style: { padding: '6px 4px' } }, h('div', { class: 'row' }, name, h('button', { class: 'btn pri', onclick: save }, w ? 'Save' : 'Create')), em);
}

function folderTree(items, prefix) {
  const subs = [...new Set(items.filter((b) => b.folder !== prefix && b.folder.startsWith(prefix + '/')).map((b) => b.folder.slice(prefix.length + 1).split('/')[0]))];
  const frag = document.createDocumentFragment();
  subs.forEach((s) => {
    const full = prefix + '/' + s;
    const d = h('details', {}, h('summary', {}, h('span', { html: icon('folder') }), s), h('div', {}, folderTree(items, full)));
    frag.append(d);
  });
  items.filter((b) => b.folder === prefix).forEach((b) => frag.append(bmRow(b)));
  return frag;
}
function bmRow(b, removable = true) {
  return h('div', { class: 'row click', title: b.url, onclick: () => cmd('openUrl', { url: b.url }), onauxclick: (e) => { if (e.button === 1) cmd('openUrl', { url: b.url, newTab: true }); } },
    h('span', { class: 'mini', style: { background: colorOf(hostname(b.url)) } }, initial(hostname(b.url) || b.title)),
    h('div', { class: 'grow' }, h('div', { class: 't' }, b.title), h('div', { class: 'sub t' }, nice(b.url))),
    removable ? h('button', { class: 'xbtn', title: 'Remove', html: icon('x'), onclick: (e) => { e.stopPropagation(); cmd('removeBookmark', { id: b.id }); } }) : null);
}
function panelFolder(el, folder) {
  const items = BM.filter((b) => b.folder === folder || b.folder.startsWith(folder + '/'));
  el.append(h('div', { class: 'ph' }, h('span', {}, folder), h('small', {}, `${items.length}`)));
  el.style.width = '360px';
  if (!items.length) el.append(h('div', { class: 'empty' }, 'Empty folder'));
  el.append(folderTree(items, folder));
}

function panelLibrary(el) {
  libTab = panel.name === 'library:history' ? 'history' : 'bookmarks';
  el.style.width = '420px';
  el.append(h('div', { class: 'seg' },
    h('button', { class: libTab === 'bookmarks' ? 'on' : '', onclick: () => openPanel('library:bookmarks', panel.anchor, panel.align) }, 'Bookmarks'),
    h('button', { class: libTab === 'history' ? 'on' : '', onclick: () => openPanel('library:history', panel.anchor, panel.align) }, 'History')));
  const q = h('input', { class: 'txt', id: 'libQ', placeholder: 'Search', value: libQuery, style: { width: 'calc(100% - 8px)', margin: '0 4px 6px' } });
  q.addEventListener('input', () => { libQuery = q.value; renderPanel(); });
  el.append(q);
  const m = (s) => !libQuery || s.toLowerCase().includes(libQuery.toLowerCase());
  if (libTab === 'bookmarks') {
    const list = BM.filter((b) => m(b.title + ' ' + b.url));
    if (!list.length) el.append(h('div', { class: 'empty' }, BM.length ? 'No matches' : 'No bookmarks yet'));
    if (libQuery) list.slice(0, 80).forEach((b) => el.append(bmRow(b)));
    else {
      const rootFolders = [...new Set(list.filter((b) => b.folder).map((b) => b.folder.split('/')[0]))];
      list.filter((b) => !b.folder).forEach((b) => el.append(bmRow(b)));
      rootFolders.forEach((f) => el.append(h('details', {}, h('summary', {}, h('span', { html: icon('folder') }), f), h('div', {}, folderTree(list.filter((b) => b.folder === f || b.folder.startsWith(f + '/')), f)))));
    }
  } else {
    const list = histCache.filter((x) => m(x.title + ' ' + x.url)).slice(0, 120);
    if (!list.length) el.append(h('div', { class: 'empty' }, 'No history yet'));
    list.forEach((x) => el.append(bmRow({ title: x.title, url: x.url }, false)));
  }
}

function panelFind(el) {
  const inp = h('input', { class: 'txt', id: 'findQ', placeholder: 'Find in page', value: findInfo.text || '' });
  const send = (fwd, next) => cmd('find', { text: inp.value, forward: fwd, next });
  inp.addEventListener('input', () => { findInfo.text = inp.value; send(true, false); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(!e.shiftKey, true); if (e.key === 'Escape') { cmd('stopFind'); closePanel(); } });
  el.append(h('div', { class: 'finder' }, inp,
    h('span', { class: 'cnt', id: 'findCnt' }, findInfo.matches ? `${findInfo.active}/${findInfo.matches}` : inp.value ? '0/0' : ''),
    h('button', { class: 'ib sm', html: icon('up'), onclick: () => send(false, true) }), h('button', { class: 'ib sm', html: icon('down'), onclick: () => send(true, true) }),
    h('button', { class: 'ib sm', html: icon('x'), onclick: () => { cmd('stopFind'); closePanel(); } })));
  setTimeout(() => { if (document.activeElement !== inp) { inp.focus(); inp.select(); } }, 0);
}

function panelGroupRename(el, gid) {
  const g = S.groups.find((x) => x.id === gid);
  if (!g) return closePanel();
  const inp = h('input', { class: 'txt', id: 'grName', value: g.name, placeholder: 'Group name', maxlength: '30', style: { flex: '1' } });
  const save = () => { cmd('renameGroup', { id: gid, name: inp.value.trim() }); closePanel(); };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  el.append(h('div', { class: 'row' }, inp, h('button', { class: 'btn pri', onclick: save }, 'Save')));
  setTimeout(() => { if (document.activeElement !== inp) { inp.focus(); inp.select(); } }, 0);
}

function panelSuggest(el) {
  el.style.padding = '6px';
  const text = $('#omniInput').value.trim();
  if (text) el.append(h('div', { class: 'sug' + (sugSel === -1 ? ' sel' : ''), onmousedown: (e) => { e.preventDefault(); go(text); } }, h('span', { html: icon('search') }), h('span', { class: 't' }, text)));
  sugs.forEach((s, i) => el.append(h('div', { class: 'sug' + (sugSel === i ? ' sel' : ''), onmousedown: (e) => { e.preventDefault(); go(s.url); } },
    h('span', { html: icon(s.kind === 'bookmark' ? 'star' : 'clock') }), h('span', { class: 't' }, s.title || s.url), h('span', { class: 'u' }, nice(s.url)))));
}

// ───────────────────────────────────────────── omnibox
const omni = $('#omniInput');
function go(text) {
  omniEditing = false; omniDirty = false; closePanel();
  cmd('navigate', { text });
  omni.blur();
}
let omniDirty = false;
omni.addEventListener('focus', () => { omniEditing = true; if (!omniDirty) setTimeout(() => { if (!omniDirty) omni.select(); }, 0); });
omni.addEventListener('blur', () => { omniDirty = false; setTimeout(() => { omniEditing = false; if (panel?.name === 'suggest') closePanel(); renderToolbar(); }, 120); });
let sugTimer = null;
omni.addEventListener('input', () => {
  omniDirty = true;
  clearTimeout(sugTimer);
  sugTimer = setTimeout(async () => {
    const seq = ++sugSeq; const text = omni.value;
    const r = text.trim() ? await cmd('suggest', { text }) : [];
    if (seq !== sugSeq || !omniEditing) return;
    sugs = r || []; sugSel = -1;
    if (!text.trim()) { if (panel?.name === 'suggest') closePanel(); return; }
    if (panel?.name === 'suggest') renderPanel(); else openPanel('suggest', $('#omni'), 'omni');
  }, 60);
});
omni.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); const pick = sugSel >= 0 ? sugs[sugSel]?.url : omni.value; go(pick || omni.value); }
  else if (e.key === 'Escape') { omniEditing = false; closePanel(); renderToolbar(); omni.blur(); cmd('setOverlay', { open: false }); }
  else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && sugs.length) {
    e.preventDefault();
    sugSel += e.key === 'ArrowDown' ? 1 : -1;
    if (sugSel >= sugs.length) sugSel = -1; if (sugSel < -1) sugSel = sugs.length - 1;
    if (sugSel >= 0) omni.value = sugs[sugSel].url;
    if (panel?.name === 'suggest') renderPanel();
  }
});

// ───────────────────────────────────────────── wiring
$('#newTab').onclick = () => cmd('newTab');
$('#back').onclick = () => cmd('back'); $('#fwd').onclick = () => cmd('forward');
$('#reload').onclick = () => cmd('reload');
$('#star').onclick = () => cmd('toggleBookmark');
$('#shield').onclick = (e) => togglePanel('shield', e.currentTarget, 'right');
$('#menu').onclick = (e) => {
  if (panel && (panel.name === 'settings' || panel.name.startsWith('library'))) return closePanel();
  togglePanel('menu', e.currentTarget, 'right');
};
$('#wsBtn').onclick = (e) => togglePanel('ws', e.currentTarget, 'left');
$('#secIcon').onclick = (e) => { if (S?.tabs.find((t) => t.id === S.activeTabId)?.url) togglePanel('site', e.currentTarget, 'left'); };
$('#dl').onclick = (e) => togglePanel('downloads', e.currentTarget, 'right');
// Enter/Space on anything acting as a button (rows, switches, chips)
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t instanceof HTMLElement && t.tagName !== 'BUTTON' && t.tagName !== 'INPUT' && ['button', 'switch'].includes(t.getAttribute('role'))) { e.preventDefault(); t.click(); }
});
$('#reload').oncontextmenu = (e) => { e.preventDefault(); cmd('hardReload'); };
$('#tabstrip').addEventListener('dblclick', (e) => { if (e.target === $('#tabstrip') || e.target.classList.contains('spacer')) cmd('newTab'); });

// click outside closes panels
document.addEventListener('mousedown', (e) => {
  if (!panel) return;
  if ($('#panel').contains(e.target)) return;
  if (panel.anchor && panel.anchor.contains(e.target)) return;
  if (panel.name === 'suggest' && $('#omni').contains(e.target)) return;
  if (panel.name === 'find') { closePanel(); cmd('stopFind'); return; }
  closePanel();
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panel) { if (panel.name === 'find') cmd('stopFind'); closePanel(); }
});


// ───────────────────────────────────────────── events from main
let lastOrder = '';
function applyToolbarOrder() {
  const order = (S.settings.toolbarOrder || []).join();
  if (order === lastOrder) return;
  lastOrder = order;
  const tb = $('#toolbar');
  for (const id of S.settings.toolbarOrder || []) { const el = document.getElementById(id); if (el && el.parentElement === tb) tb.append(el); }
  $('#omni').after($('#mini'));
  $('#menu').before($('#dl'));
}

// edit mode: drag toolbar items to reorder, drag the sidebar and corner controls to a new spot
let dragItem = null;
let editSig = null;
function renderEdit() {
  const layer = $('#editLayer');
  document.body.classList.toggle('editing', !!S.editMode);
  const tb = $('#toolbar');
  [...tb.children].forEach((el) => {
    el.draggable = !!S.editMode;
    if (el.dataset.editWired) return;
    el.dataset.editWired = '1';
    el.addEventListener('dragstart', (e) => { if (!S.editMode) return; dragItem = el; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); dragItem = null; });
    el.addEventListener('dragover', (e) => {
      if (!S.editMode || !dragItem || dragItem === el || dragItem.parentElement !== tb) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      tb.insertBefore(dragItem, e.clientX < r.left + r.width / 2 ? el : el.nextSibling);
    });
    el.addEventListener('drop', (e) => {
      if (!S.editMode || !dragItem) return;
      e.preventDefault();
      const order = [...tb.children].map((c) => c.id).filter(Boolean);
      lastOrder = order.join();
      cmd('setSetting', { key: 'toolbarOrder', value: order });
    });
  });
  // only rebuild the drop zones when something they show changed — rebuilding on every
  // state push (page loads, blocked trackers…) destroyed the chip mid-drag and cancelled it
  const st = S.settings;
  const sig = S.editMode ? st.sidebar : '';
  if (sig === editSig) return;
  editSig = sig;
  layer.innerHTML = '';
  if (!S.editMode) return;
  const chip = (kind, label) => {
    const c = h('div', { class: 'echip', draggable: 'true' }, label);
    c.addEventListener('dragstart', (e) => { dragItem = { kind }; e.dataTransfer.setData('text/plain', kind); });
    return c;
  };
  const zone = (cls, kind, value, label, current) => {
    const z = h('div', { class: 'ezone ' + cls + (current ? ' cur' : '') }, current ? chip(kind, label) : h('span', {}, label));
    z.addEventListener('dragover', (e) => { if (dragItem && dragItem.kind === kind) { e.preventDefault(); z.classList.add('over'); } });
    z.addEventListener('dragleave', () => z.classList.remove('over'));
    z.addEventListener('drop', (e) => { e.preventDefault(); z.classList.remove('over'); if (dragItem?.kind === kind) cmd('setSetting', { key: 'sidebar', value }); dragItem = null; });
    return z;
  };
  layer.append(
    h('div', { class: 'ebanner' }, h('b', {}, 'Edit layout'), h('span', {}, 'Drag toolbar buttons to reorder them, and the sidebar to either side.'),
      h('button', { class: 'btn pri', onclick: () => cmd('setEditMode', { on: false }) }, 'Done')),
    zone('side-l', 'side', 'left', 'Sidebar', st.sidebar === 'left'),
    zone('side-r', 'side', 'right', 'Sidebar', st.sidebar === 'right'),
    zone('side-off', 'side', 'off', st.sidebar === 'off' ? 'Sidebar (hidden)' : 'Drop here to hide the sidebar', st.sidebar === 'off'),
  );
}

function renderNoticeBar() {
  const text = S.notice || '';
  const dismissed = localStorage.getItem('notice-off') === text;
  let bar = document.getElementById('noticeBar');
  if (!text || dismissed) { if (bar) bar.remove(); return; }
  if (bar && bar.dataset.text === text) return;
  if (bar) bar.remove();
  bar = h('div', { id: 'noticeBar' },
    h('span', { class: 'ntxt' }, text),
    h('button', { class: 'x', title: 'Dismiss', onclick: () => { localStorage.setItem('notice-off', text); bar.remove(); } }, '×'));
  bar.dataset.text = text;
  document.body.append(bar);
}
function renderAuthBar() {
  const at = S.tabs.find((t) => t.id === S.activeTabId);
  const on = !!(at && at.authSignin) && !localStorage.getItem('authbar-off');
  let bar = document.getElementById('authBar');
  if (!on) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = h('div', { id: 'authBar' },
      h('span', {}, 'Trouble signing in? Sign-ins often work better in your main browser.'),
      h('button', { class: 'btn pri sm', onclick: () => cmd('openExternal', {}) }, 'Open in default browser'),
      h('button', { class: 'x', title: 'Dismiss', onclick: () => { localStorage.setItem('authbar-off', '1'); bar.remove(); } }, '×'));
    document.body.append(bar);
  }
}
// "example.com wants to use your camera": shown under the toolbar for the tab that asked
let permShown = null;
function renderPermBar() {
  const p = S.permPrompt;
  const bar = $('#permBar');
  document.documentElement.style.setProperty('--perm-h', p && !document.body.classList.contains('vertical') ? '52px' : '0px');
  if (!p) { bar.hidden = true; bar.innerHTML = ''; permShown = null; return; }
  if (permShown === p.id) return;
  permShown = p.id;
  const answer = (a) => cmd('answerPermission', { id: p.id, answer: a });
  bar.hidden = false; bar.innerHTML = '';
  bar.setAttribute('aria-label', `${p.host} wants to ${p.text}`);
  bar.append(
    h('span', { class: 'pm-ic', html: icon(p.kind === 'geolocation' ? 'globe' : 'shield') }),
    h('div', { class: 'pm-t' }, h('b', {}, p.host), ` wants to ${p.text}`, p.private ? h('span', { class: 'pm-sub' }, ' · forgotten when you close private tabs') : null),
    h('button', { class: 'btn sm', onclick: () => answer('block') }, 'Block'),
    h('button', { class: 'btn sm', onclick: () => answer('once') }, 'Allow this time'),
    h('button', { class: 'btn sm pri', onclick: () => answer('allow') }, 'Allow'),
    h('button', { class: 'x', title: 'Not now', 'aria-label': 'Not now', onclick: () => answer('dismiss') }, '×'));
}


api.onState((s) => { S = s; render(); applyToolbarOrder(); renderEdit(); renderAuthBar(); renderNoticeBar(); renderPermBar(); });
api.onBookmarks((b) => { BM = b || []; if (S) { renderBookmarksBar(); if (panel) renderPanel(); } });
function showToast(msg) {
  const t = $('#toast'); t.textContent = msg;
  $('#toastStrip').classList.add('show');
  clearTimeout(toastTimerUI); toastTimerUI = setTimeout(() => $('#toastStrip').classList.remove('show'), 2600);
}
api.onToast(showToast);
api.onFindResult((r) => { findInfo = r; const c = $('#findCnt'); if (c) c.textContent = r.matches ? `${r.active}/${r.matches}` : r.text === '' ? '' : '0/0'; });
api.onFocusOmnibox(() => { omniDirty = false; omni.focus(); omni.select(); });
api.onOpenFind(() => { findInfo = { text: findInfo.text, active: 0, matches: 0 }; openPanel('find', null, 'right'); });
api.onOpenPanel((name) => {
  if (name === 'menu') openPanel('settings', $('#menu'), 'right');
  else if (name === 'keys') { menuTab = 'keys'; openPanel('settings', $('#menu'), 'right'); }
  else if (name.startsWith('library')) { libTab = name.split(':')[1]; openPanel(name, $('#menu'), 'right'); }
  else if (name === 'downloads') openPanel('downloads', $('#dl').hidden ? $('#menu') : $('#dl'), 'right');
});
api.onRenameGroup(({ id }) => { const chip = document.querySelector(`[data-gid="${id}"]`); openPanel('grename:' + id, chip, 'left'); });
api.onRenameWorkspace(({ id, name }) => { wsEdit = { id, name }; openPanel('ws', $('#wsBtn'), 'left'); setTimeout(() => $('#wsName')?.focus(), 30); });

api.ready();
