'use strict';
// Spotify Web API: sign-in (Authorization Code + PKCE, no client secret), token refresh,
// now-playing polling and playback control. Tokens are encrypted with the OS keychain.
const { shell, safeStorage } = require('electron');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

// Create an app at https://developer.spotify.com/dashboard, add the redirect URI below, and paste its Client ID here.
const CLIENT_ID = '929c18462c7f4440b6f71c47f106326b';
const PORT = 43821;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
  'user-library-read', 'user-library-modify', 'playlist-read-private', 'playlist-read-collaborative',
].join(' ');
const API = 'https://api.spotify.com/v1';

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function create({ file, onChange, fast }) {
  let tok = load();           // { access, refresh, expires }
  let now = null;             // last /me/player snapshot
  let liked = false, likedId = '';
  let error = '';
  let pollTimer = null, server = null;

  function load() {
    try {
      const raw = fs.readFileSync(file);
      return JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString());
    } catch { return null; }
  }
  function save() {
    try {
      if (!tok) return fs.rmSync(file, { force: true });
      const json = JSON.stringify(tok);
      fs.writeFileSync(file, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : json);
    } catch { /* ignore */ }
  }

  async function tokenRequest(params) {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
    });
    const j = parseBody(await r.text());
    if (!r.ok) throw new Error(friendly(j.error_description || j.error || j.text || 'Spotify sign-in failed'));
    tok = { access: j.access_token, refresh: j.refresh_token || tok?.refresh, expires: Date.now() + (j.expires_in - 60) * 1000 };
    save();
  }

  // Spotify sometimes answers with plain text instead of JSON (e.g. account restrictions)
  function parseBody(text) {
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { text: text.trim().slice(0, 200) }; }
  }
  function friendly(msg) {
    if (/premium subscription required for the owner/i.test(msg)) return 'The Spotify developer app\'s owner account needs an active Spotify Premium subscription';
    if (/user not registered|not registered in the developer dashboard/i.test(msg)) return 'Add your Spotify email under User Management in the Spotify developer dashboard';
    return msg;
  }

  async function call(method, path, body, retried) {
    if (!tok) throw new Error('not connected');
    if (Date.now() > tok.expires) {
      try { await tokenRequest({ grant_type: 'refresh_token', refresh_token: tok.refresh }); }
      catch (e) { tok = null; save(); onChange(); throw e; }
    }
    const r = await fetch(API + path, {
      method, headers: { authorization: 'Bearer ' + tok.access, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401 && !retried) { tok.expires = 0; return call(method, path, body, true); }
    if (r.status === 204 || r.status === 202) return null;
    const j = parseBody(await r.text());
    if (!r.ok) {
      if (j.error?.reason === 'PREMIUM_REQUIRED') throw new Error('Playback control needs Spotify Premium');
      throw new Error(friendly(j.error?.message || j.text || `Spotify error ${r.status}`));
    }
    return j.text !== undefined ? null : j;
  }

  function connect() {
    if (!CLIENT_ID) { error = 'Spotify Client ID is not set (see spotify.js)'; onChange(); return; }
    if (server) server.close();
    const verifier = b64url(crypto.randomBytes(48));
    const state = b64url(crypto.randomBytes(16));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    server = http.createServer(async (req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== '/callback') { res.writeHead(404); return res.end(); }
      const ok = u.searchParams.get('state') === state && u.searchParams.get('code');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<body style="font:16px system-ui;background:#181818;color:#eee;display:grid;place-items:center;height:100vh;margin:0">${ok ? 'Spotify connected — you can close this tab and go back to opentab.' : 'Spotify sign-in was cancelled.'}</body>`);
      server.close(); server = null;
      if (!ok) return;
      try {
        await tokenRequest({ grant_type: 'authorization_code', code: u.searchParams.get('code'), redirect_uri: REDIRECT, code_verifier: verifier });
        error = ''; poll();
      } catch (e) { error = e.message; onChange(); }
    });
    server.on('error', (e) => { error = 'Could not start sign-in: ' + e.message; server = null; onChange(); });
    server.listen(PORT, '127.0.0.1', () => {
      const q = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: challenge });
      shell.openExternal('https://accounts.spotify.com/authorize?' + q);
    });
    setTimeout(() => { if (server) { server.close(); server = null; } }, 5 * 60 * 1000);
  }

  function disconnect() { tok = null; now = null; save(); onChange(); }

  async function poll() {
    if (!tok) return;
    try {
      now = await call('GET', '/me/player?additional_types=episode');
      const id = now?.item?.id || '';
      if (id && id !== likedId) {
        likedId = id;
        try { liked = !!(await call('GET', '/me/tracks/contains?ids=' + id))?.[0]; } catch { liked = false; }
      }
      error = '';
    } catch (e) { error = e.message; }
    onChange();
  }

  // poll while the music control is on — faster while its card is open
  function setActive(on) {
    clearTimeout(pollTimer); pollTimer = null;
    if (!on) return;
    const loop = async () => { if (tok) await poll(); pollTimer = setTimeout(loop, fast() ? 1500 : 5000); };
    loop();
  }

  // run a command, then refresh shortly after so the UI reflects it
  async function act(fn) {
    try { await fn(); error = ''; } catch (e) { error = e.message; onChange(); }
    setTimeout(poll, 350);
  }

  const it = () => now?.item;
  return {
    connected: () => !!tok,
    hasClientId: () => !!CLIENT_ID,
    connect, disconnect, setActive, poll,
    snapshot() {
      const i = it();
      return {
        connected: !!tok, error,
        playing: !!now?.is_playing,
        title: i?.name || '', artist: i ? (i.artists || [i.show]).filter(Boolean).map((a) => a.name).join(', ') : '',
        art: (i?.album?.images || i?.images || [])[1]?.url || (i?.album?.images || i?.images || [])[0]?.url || '',
        uri: i?.uri || '', progress: now?.progress_ms || 0, duration: i?.duration_ms || 0, at: Date.now(),
        device: now?.device?.name || '', volume: now?.device?.volume_percent ?? null,
        shuffle: !!now?.shuffle_state, repeat: now?.repeat_state || 'off', liked,
      };
    },
    toggle: () => act(() => call('PUT', now?.is_playing ? '/me/player/pause' : '/me/player/play')),
    next: () => act(() => call('POST', '/me/player/next')),
    prev: () => act(() => call('POST', '/me/player/previous')),
    seek: (ms) => act(() => call('PUT', '/me/player/seek?position_ms=' + Math.max(0, Math.round(ms)))),
    volume: (v) => act(() => call('PUT', '/me/player/volume?volume_percent=' + Math.max(0, Math.min(100, Math.round(v))))),
    shuffle: () => act(() => call('PUT', '/me/player/shuffle?state=' + !now?.shuffle_state)),
    repeat: () => act(() => call('PUT', '/me/player/repeat?state=' + ({ off: 'context', context: 'track', track: 'off' }[now?.repeat_state] || 'off'))),
    like: () => act(async () => { const id = it()?.id; if (!id) return; await call(liked ? 'DELETE' : 'PUT', '/me/tracks?ids=' + id); liked = !liked; }),
    play: (a) => act(() => call('PUT', '/me/player/play', a.context ? { context_uri: a.context } : { uris: [a.uri] })),
    async search(q) {
      if (!q) return [];
      const j = await call('GET', '/search?type=track&limit=12&q=' + encodeURIComponent(q));
      return (j?.tracks?.items || []).map((t) => ({ uri: t.uri, title: t.name, sub: t.artists.map((a) => a.name).join(', '), art: t.album.images.at(-1)?.url || '' }));
    },
    async playlists() {
      const j = await call('GET', '/me/playlists?limit=30');
      return (j?.items || []).filter(Boolean).map((p) => ({ uri: p.uri, title: p.name, sub: `${p.tracks?.total ?? ''} tracks`, art: p.images?.at(-1)?.url || '' }));
    },
  };
}

module.exports = { create, REDIRECT };
