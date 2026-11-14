import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Ensures the Electron binary is properly extracted even if `extract-zip`
 * stalls on macOS `.framework` symlinks under bleeding-edge Node 26+.
 */
const electronDir = path.resolve('node_modules', 'electron');
if (!fs.existsSync(electronDir)) {
  process.exit(0);
}

const pathTxt = path.join(electronDir, 'path.txt');
if (fs.existsSync(pathTxt)) {
  const relBin = fs.readFileSync(pathTxt, 'utf8').trim();
  if (relBin && fs.existsSync(path.join(electronDir, 'dist', relBin))) {
    process.exit(0);
  }
}

if (process.platform === 'darwin') {
  const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'));
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const zipName = `electron-v${pkg.version}-darwin-${arch}.zip`;
  const cacheRoot = path.join(os.homedir(), 'Library', 'Caches', 'electron');

  let foundZip = null;
  if (fs.existsSync(cacheRoot)) {
    for (const entry of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const candidate = path.join(cacheRoot, entry.name, zipName);
        if (fs.existsSync(candidate)) {
          foundZip = candidate;
          break;
        }
      }
      if (entry.isFile() && entry.name === zipName) {
        foundZip = path.join(cacheRoot, entry.name);
        break;
      }
    }
  }

  if (foundZip) {
    const distDir = path.join(electronDir, 'dist');
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });
    execFileSync('/usr/bin/ditto', ['-x', '-k', foundZip, distDir]);
    fs.writeFileSync(pathTxt, 'Electron.app/Contents/MacOS/Electron', 'utf8');
    console.log(`[ensure-electron] Extracted ${zipName} via macOS ditto.`);
  }
}
