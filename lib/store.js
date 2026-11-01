'use strict';
// Tiny JSON store: loads once, writes are debounced and atomic (write .tmp, then rename).
const path = require('path');
const fs = require('fs');

function makeStore(dir, file, fallback, { delay = 400 } = {}) {
  const p = path.join(dir, file);
  let data;
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { data = null; }
  if (data == null) data = typeof fallback === 'function' ? fallback() : fallback;
  let timer = null;
  const flush = () => {
    clearTimeout(timer); timer = null;
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p + '.tmp', JSON.stringify(data));
      fs.renameSync(p + '.tmp', p);
    } catch (e) { console.error('store write failed', file, e.message); }
  };
  return {
    get data() { return data; },
    set data(v) { data = v; },
    save() { if (!timer) timer = setTimeout(flush, delay); },
    flush,
  };
}

module.exports = { makeStore };
