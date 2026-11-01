'use strict';
// Address bar input -> URL. searchUrl has a %s where the query goes.

function normalizeInput(raw, searchUrl) {
  const text = String(raw || '').trim();
  if (!text) return 'opentab://newtab';
  if (/^(javascript|data|vbscript|blob):/i.test(text)) return 'opentab://newtab';
  if (/^opentab:\/\//i.test(text)) return text;
  if (/^about:blank$/i.test(text)) return 'opentab://newtab';
  if (/^(https?|file|ftp):\/\//i.test(text)) return text;
  if (!/\s/.test(text)) {
    if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?([/?#].*)?$/i.test(text)) return 'http://' + text;
    if (/^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(text)) return 'https://' + text;
  }
  return searchUrl.replace('%s', encodeURIComponent(text));
}

// Files that can run code when opened. Downloads of these wait for the user to keep them.
const RISKY_EXT = new Set(['.exe', '.msi', '.msix', '.appx', '.bat', '.cmd', '.com', '.scr', '.pif', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.hta', '.lnk', '.reg', '.jar', '.cpl', '.dll', '.sys', '.iso', '.img', '.vhd', '.vhdx', '.application', '.gadget', '.msp', '.scf', '.url', '.xll', '.docm', '.xlsm', '.pptm']);
const isRiskyFile = (name) => RISKY_EXT.has(require('path').extname(String(name || '')).toLowerCase());

module.exports = { normalizeInput, isRiskyFile };
