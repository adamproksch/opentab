'use strict';
// Opt-in crash and error reports (Settings → General → Send crash reports, off by default).
// A report is the kind of failure, the error message, the stack inside opentab's own code,
// app version and OS. Never page addresses, page content or anything typed.
const os = require('os');

function scrub(s) {
  let out = String(s || '');
  const home = os.homedir();
  if (home) out = out.split(home).join('~');
  // a stray URL in an error message could reveal a site the user visited
  return out.replace(/\b(?:https?|wss?|file):\/\/[^\s)'"]+/gi, '<url>');
}

function createCrashReporter({ enabled, endpoint, info, fetch }) {
  const sent = new Map(); // same error at most once per run
  async function report(kind, err) {
    if (!enabled()) return;
    const message = scrub(err && err.message ? err.message : err).slice(0, 500);
    const stack = scrub(err && err.stack ? err.stack : '').slice(0, 4000);
    const key = kind + '|' + message;
    if (sent.has(key) || sent.size > 30) return;
    sent.set(key, true);
    try {
      await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...info(), kind, message, stack }) });
    } catch { /* offline: drop it */ }
  }
  function install(app) {
    process.on('uncaughtException', (e) => { console.error('uncaught', e); report('main-exception', e); });
    process.on('unhandledRejection', (e) => { console.error('unhandled rejection', e); report('main-rejection', e); });
    // only the reason and exit code; which page was open is never sent
    app.on('render-process-gone', (e, wc, d) => { if (d.reason !== 'clean-exit' && d.reason !== 'killed') report('renderer-' + d.reason, { message: `exit ${d.exitCode}` }); });
    app.on('child-process-gone', (e, d) => { if (d.reason !== 'clean-exit' && d.reason !== 'killed') report(`${d.type}-${d.reason}`, { message: `${d.name || d.serviceName || d.type} exit ${d.exitCode}` }); });
  }
  return { report, install };
}

module.exports = { createCrashReporter, scrub };
