// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../../../src/main/services/app-state';
import { collectOssLicenses, readOssLicenses } from '../../../src/main/services/diagnostics/oss-licenses';
import { createHomeScrubber, RingBuffer, scrubValue } from '../../../src/main/services/diagnostics/scrub';
import { buildDiagnosticZip, diagnosticZipFileName, type SystemInfo } from '../../../src/main/services/diagnostics/zip';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aie-diag-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('home scrubber', () => {
  it('replaces the home directory in all common spellings', () => {
    const scrub = createHomeScrubber('/Users/jane');
    expect(scrub('open /Users/jane/Documents/x.wav')).toBe('open ~/Documents/x.wav');
    expect(scrub('a /Users/jane b /Users/jane')).toBe('a ~ b ~');
    const win = createHomeScrubber('C:\\Users\\Jane');
    expect(win('C:\\Users\\Jane\\Music')).toBe('~\\Music');
    expect(win('c:/users/jane/Music')).toBe('~/Music');
    expect(win('{"p":"C:\\\\Users\\\\Jane\\\\Music"}')).toBe('{"p":"~\\\\Music"}');
  });

  it('is a no-op for a root-like home and scrubs nested values and errors', () => {
    expect(createHomeScrubber('/')('/usr/bin')).toBe('/usr/bin');
    const scrub = createHomeScrubber('/Users/jane');
    const err = new Error('failed at /Users/jane/p');
    const out = scrubValue({ a: ['/Users/jane/a', err], n: 1 }, scrub) as { a: [string, { message: string; stack: string }]; n: number };
    expect(out.a[0]).toBe('~/a');
    expect(out.a[1].message).toBe('failed at ~/p');
    expect(out.a[1].stack).not.toContain('/Users/jane');
    expect(out.n).toBe(1);
  });

  it('keeps only the last 100 entries in the ring buffer', () => {
    const ring = new RingBuffer<number>(100);
    for (let i = 0; i < 250; i++) ring.push(i);
    expect(ring.size).toBe(100);
    expect(ring.toArray()[0]).toBe(150);
    expect(ring.toArray().at(-1)).toBe(249);
  });
});

describe('diagnostic zip', () => {
  it('contains scrubbed rotated logs, system-info.json and recent events', async () => {
    const home = '/Users/jane';
    const scrub = createHomeScrubber(home);
    const logsDir = path.join(dir, 'logs');
    fs.mkdirSync(logsDir);
    fs.writeFileSync(path.join(logsDir, 'main.log'), `[info] opened ${home}/Music/p\n`);
    fs.writeFileSync(path.join(logsDir, 'main.old.log'), `[warn] old ${home}/x\n`);
    fs.writeFileSync(path.join(logsDir, 'notes.txt'), 'not a log');

    const settings = {
      ...createDefaultSettings('en-US'),
      inputDeviceId: 'abcd-1234-hardware-id',
      externalTools: { vLabelerPath: `${home}/Apps/vLabeler.app`, openUtauPath: '' }
    };
    const systemInfo: SystemInfo = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      appVersion: '1.0.0',
      electronVersion: '35.0.0',
      chromeVersion: '134',
      nodeVersion: '22',
      platform: 'darwin',
      osRelease: '25.0.0',
      arch: 'arm64',
      systemLocale: 'en-US',
      settings
    };
    const zip = await buildDiagnosticZip({
      logsDir,
      systemInfo,
      recentEvents: [{ at: 'now', level: 'info', message: 'hi' }],
      scrub
    });
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['logs/main.log', 'logs/main.old.log', 'recent-events.json', 'system-info.json']);
    expect(strFromU8(files['logs/main.log']!)).toBe('[info] opened ~/Music/p\n');
    expect(strFromU8(files['logs/main.old.log']!)).toContain('~/x');
    const info = JSON.parse(strFromU8(files['system-info.json']!)) as SystemInfo;
    expect(info).toMatchObject({ appVersion: '1.0.0', platform: 'darwin', arch: 'arm64', electronVersion: '35.0.0' });
    expect(info.settings.inputDeviceId).toBe('[redacted-device-id]');
    expect(info.settings.externalTools.vLabelerPath).toBe('~/Apps/vLabeler.app');
    expect(strFromU8(files['system-info.json']!)).not.toContain('jane');
  });

  it('still builds when there are no logs and names the file by date', async () => {
    const zip = await buildDiagnosticZip({
      logsDir: path.join(dir, 'none'),
      systemInfo: {
        generatedAt: '', appVersion: '', electronVersion: '', chromeVersion: '', nodeVersion: '',
        platform: '', osRelease: '', arch: '', systemLocale: '', settings: createDefaultSettings()
      },
      recentEvents: [],
      scrub: (t) => t
    });
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(['recent-events.json', 'system-info.json']);
    expect(diagnosticZipFileName(new Date(2026, 2, 5))).toBe('aie-diagnostics-20260305.zip');
  });
});

describe('oss licenses', () => {
  it('collects transitive production deps and merges compiled output', () => {
    const mk = (name: string, pkg: object, license?: string): void => {
      const d = path.join(dir, 'node_modules', name);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...pkg }));
      if (license) fs.writeFileSync(path.join(d, 'LICENSE'), license);
    };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'app', dependencies: { a: '1' }, devDependencies: { dev: '1' } }));
    mk('a', { license: 'MIT', author: { name: 'Ann' }, dependencies: { b: '1' } }, 'MIT text');
    mk('b', { licenses: [{ type: 'ISC' }], repository: 'github:x/b' });
    mk('dev', { license: 'MIT' });
    const list = collectOssLicenses(dir);
    expect(list.map((e) => e.name)).toEqual(['a', 'b']);
    expect(list[0]).toMatchObject({ license: 'MIT', author: 'Ann', licenseText: 'MIT text' });
    expect(list[1]).toMatchObject({ license: 'ISC', repository: 'github:x/b' });

    const compiled = path.join(dir, 'oss.json');
    fs.writeFileSync(compiled, JSON.stringify([{ name: 'bundled', version: '2.0.0', license: 'MIT', author: '', repository: '', licenseText: 't' }]));
    expect(readOssLicenses({ compiledPath: compiled, appRoot: dir }).map((e) => e.name)).toEqual(['a', 'b', 'bundled']);
    expect(readOssLicenses({ compiledPath: path.join(dir, 'missing.json'), appRoot: dir }).length).toBe(2);
  });
});
