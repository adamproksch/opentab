// Builds dist/opentab-Installer.exe from build/bootstrap.nsi using the NSIS
// that electron-builder already downloaded. Upload it with every release.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cache = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache');
const find = (dir, test) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (test(p)) return p;
    if (fs.statSync(p).isDirectory()) { const r = find(p, test); if (r) return r; }
  }
  return null;
};
const nsisDir = fs.readdirSync(cache).find((n) => /^nsis-\d/.test(n));
const resDir = fs.readdirSync(cache).find((n) => /^nsis-resources-/.test(n));
const makensis = find(path.join(cache, nsisDir), (p) => p.endsWith(path.join('Bin', 'makensis.exe')));
const plugins = find(path.join(cache, resDir), (p) => p.endsWith(path.join('plugins', 'x86-unicode')));

execFileSync(makensis, ['-V2', `-X!addplugindir /x86-unicode "${plugins}"`, 'bootstrap.nsi'], { cwd: __dirname, stdio: 'inherit' });
console.log('built dist/opentab-Installer.exe');
