import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Verifies the Electron binary is extracted across macOS (`darwin`),
 * Windows (`win32`), and Linux (`linux`) during `npm ci`, with a fast
 * `ditto` cache fallback on macOS if `extract-zip` stalls on `.framework` symlinks.
 */
if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
  process.exit(0);
}

const electronDir = path.resolve('node_modules', 'electron');
if (!fs.existsSync(electronDir)) {
  process.exit(0);
}

const pathTxt = path.join(electronDir, 'path.txt');

function hasValidElectronBinary() {
  if (!fs.existsSync(pathTxt)) {
    return false;
  }
  const relBin = fs.readFileSync(pathTxt, 'utf8').trim();
  if (!relBin) {
    return false;
  }
  const overrideDist = process.env.ELECTRON_OVERRIDE_DIST_PATH;
  const targetBin = overrideDist
    ? path.join(overrideDist, relBin)
    : path.join(electronDir, 'dist', relBin);
  return fs.existsSync(targetBin);
}

if (hasValidElectronBinary()) {
  process.exit(0);
}

if (process.platform === 'darwin') {
  const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'));
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const zipName = `electron-v${pkg.version}-darwin-${arch}.zip`;
  const cacheRoot =
    process.env.electron_config_cache || path.join(os.homedir(), 'Library', 'Caches', 'electron');

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

if (!hasValidElectronBinary()) {
  const installScript = path.join(electronDir, 'install.js');
  if (fs.existsSync(installScript)) {
    console.log(`[ensure-electron] Running electron/install.js on ${process.platform}-${process.arch}...`);
    execFileSync(process.execPath, [installScript], { stdio: 'inherit' });
  }
}

if (!hasValidElectronBinary()) {
  console.error(
    `[ensure-electron] Electron binary missing under ${electronDir} on ${process.platform}-${process.arch}.`
  );
  process.exit(1);
}
