import fs from 'node:fs';
import path from 'node:path';
import type { OssLicenseEntry } from '@shared/types';

const MAX_LICENSE_TEXT = 24_000;
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.[a-z]+)?$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function licenseName(pkg: Record<string, unknown>): string {
  const license = pkg['license'];
  if (typeof license === 'string') return license;
  if (isRecord(license) && typeof license['type'] === 'string') return license['type'];
  const licenses = pkg['licenses'];
  if (Array.isArray(licenses)) {
    const names = licenses.map((l) => (isRecord(l) && typeof l['type'] === 'string' ? l['type'] : null));
    const joined = names.filter((n): n is string => n !== null).join(' OR ');
    if (joined) return joined;
  }
  return 'UNKNOWN';
}

function entryFromPackage(dir: string, pkg: Record<string, unknown>): OssLicenseEntry {
  const author = pkg['author'];
  const repository = pkg['repository'];
  let licenseText = '';
  try {
    const file = fs.readdirSync(dir).find((n) => LICENSE_FILE.test(n));
    if (file) licenseText = fs.readFileSync(path.join(dir, file), 'utf8').slice(0, MAX_LICENSE_TEXT);
  } catch {
    // no license file shipped
  }
  return {
    name: typeof pkg['name'] === 'string' ? pkg['name'] : path.basename(dir),
    version: typeof pkg['version'] === 'string' ? pkg['version'] : '',
    license: licenseName(pkg),
    author:
      typeof author === 'string' ? author : isRecord(author) && typeof author['name'] === 'string' ? author['name'] : '',
    repository:
      typeof repository === 'string'
        ? repository
        : isRecord(repository) && typeof repository['url'] === 'string'
          ? repository['url']
          : '',
    licenseText
  };
}

/**
 * Walks the production dependency graph of `appRoot/package.json` through
 * `node_modules` (works unpackaged and inside `app.asar`).
 */
export function collectOssLicenses(appRoot: string): OssLicenseEntry[] {
  const rootPkg = readJson(path.join(appRoot, 'package.json'));
  if (!rootPkg) return [];
  const entries = new Map<string, OssLicenseEntry>();
  const queue: Array<{ name: string; from: string }> = Object.keys(
    isRecord(rootPkg['dependencies']) ? rootPkg['dependencies'] : {}
  ).map((name) => ({ name, from: appRoot }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    const candidates = [
      path.join(next.from, 'node_modules', next.name),
      path.join(appRoot, 'node_modules', next.name)
    ];
    const dir = candidates.find((c) => fs.existsSync(path.join(c, 'package.json')));
    if (!dir || visited.has(dir)) continue;
    visited.add(dir);
    const pkg = readJson(path.join(dir, 'package.json'));
    if (!pkg) continue;
    const entry = entryFromPackage(dir, pkg);
    entries.set(`${entry.name}@${entry.version}`, entry);
    const deps = isRecord(pkg['dependencies']) ? Object.keys(pkg['dependencies']) : [];
    const optional = isRecord(pkg['optionalDependencies']) ? Object.keys(pkg['optionalDependencies']) : [];
    for (const name of [...deps, ...optional]) queue.push({ name, from: dir });
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function readCompiled(compiledPath: string): OssLicenseEntry[] {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(compiledPath, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OssLicenseEntry => isRecord(e) && typeof e['name'] === 'string' && typeof e['license'] === 'string'
    );
  } catch {
    return [];
  }
}

/**
 * `out/oss-licenses.json` only lists *bundled* code (externalized deps are not
 * bundled), so it is merged with a `node_modules` scan for a complete list.
 */
export function readOssLicenses(options: { compiledPath: string; appRoot: string }): OssLicenseEntry[] {
  const merged = new Map<string, OssLicenseEntry>();
  for (const entry of collectOssLicenses(options.appRoot)) merged.set(`${entry.name}@${entry.version}`, entry);
  for (const entry of readCompiled(options.compiledPath)) {
    const key = `${entry.name}@${entry.version}`;
    const existing = merged.get(key);
    // Prefer whichever record actually carries the license text.
    if (!existing || (existing.licenseText === '' && entry.licenseText !== '')) merged.set(key, entry);
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}
