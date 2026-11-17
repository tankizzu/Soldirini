// Prende dal repository git una versione pubblicata del sito (per confrontare il prima e il dopo).
// Stesso metodo della prova di compatibilità con la v21 (pensione-app.spec.js): commit locale, altrimenti git fetch.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function sitoDaCommit(sha, varAmbiente) {
  if (varAmbiente && process.env[varAmbiente]) return { sito: path.resolve(process.env[varAmbiente]) };
  const dir = path.join(os.tmpdir(), 'soldirini-' + sha.slice(0, 7));
  if (fs.existsSync(path.join(dir, 'soldirini', 'index.html'))) return { sito: path.join(dir, 'soldirini') };
  const git = (...a) => execFileSync('git', a, { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  try {
    const radice = git('rev-parse', '--show-toplevel').toString().trim();
    try { git('cat-file', '-e', sha + '^{commit}'); } catch (e) { git('fetch', '--quiet', '--depth=1', 'origin', sha); }
    const tar = execFileSync('git', ['archive', '--format=tar', sha, 'soldirini'], { cwd: radice, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 256 * 1024 * 1024 });
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('tar', ['-x', '-C', dir], { input: tar, timeout: 60000 });
    return { sito: path.join(dir, 'soldirini') };
  } catch (e) {
    return { motivo: `impossibile prendere il commit ${sha.slice(0, 7)} dal repository git: ` + String(e.stderr || e.message).trim().split('\n')[0] };
  }
}

module.exports = { sitoDaCommit };
