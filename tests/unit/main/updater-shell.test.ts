// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { UpdateStatusInfo } from '@shared/types';
import { createDefaultSettings } from '../../../src/main/services/app-state';
import { createShellHandoff, discoverToolCandidates, parseSafeExternalUrl } from '../../../src/main/services/shell-handoff';
import {
  channelForVersion,
  compareVersions,
  createUpdater,
  pickLatestRelease,
  type AutoUpdaterLike
} from '../../../src/main/services/updater';
import { createDomainServices } from '../../../src/main/ipc/domain-services-adapter';

describe('updater', () => {
  it('detects channels and compares semver precedence', () => {
    expect(channelForVersion('1.0.0')).toBe('latest');
    expect(channelForVersion('1.0.0-beta.2')).toBe('beta');
    expect(channelForVersion('1.0.0-alpha.0')).toBe('beta');
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0-beta.3')).toBe(1);
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('junk', '1.0.0')).toBeNull();
  });

  const releases = [
    { tag_name: 'v1.1.0-beta.1', html_url: 'u-beta', draft: false, prerelease: true },
    { tag_name: 'v1.0.1', html_url: 'u-stable', draft: false, prerelease: false },
    { tag_name: 'v1.2.0', html_url: 'u-draft', draft: true, prerelease: false }
  ];

  it('picks releases per channel, ignoring drafts', () => {
    expect(pickLatestRelease(releases, 'latest')?.html_url).toBe('u-stable');
    expect(pickLatestRelease(releases, 'beta')?.html_url).toBe('u-beta');
  });

  it('falls back to GitHub metadata on unsigned macOS', async () => {
    const statuses: UpdateStatusInfo[] = [];
    const loadAutoUpdater = vi.fn();
    const openExternalUrl = vi.fn(async () => undefined);
    const updater = createUpdater({
      currentVersion: '1.0.0',
      isPackaged: true,
      platform: 'darwin',
      isMacSigned: async () => false,
      loadAutoUpdater: loadAutoUpdater as unknown as () => AutoUpdaterLike,
      fetchReleases: async () => releases,
      openExternalUrl,
      onStatus: (s) => statuses.push(s)
    });
    const info = await updater.checkForUpdates();
    expect(info).toEqual({ status: 'available', canSelfInstall: false, version: '1.0.1', releaseUrl: 'u-stable' });
    expect(loadAutoUpdater).not.toHaveBeenCalled();
    expect(statuses[0]?.status).toBe('checking');
    await updater.installDownloadedUpdate();
    expect(openExternalUrl).toHaveBeenCalledWith('u-stable');
  });

  it('reports idle when current, error on failure, and disabled in dev', async () => {
    const base = { currentVersion: '1.0.1', platform: 'darwin' as const, isMacSigned: async () => false, loadAutoUpdater: () => { throw new Error('no'); }, openExternalUrl: async () => undefined, onStatus: () => undefined };
    expect((await createUpdater({ ...base, isPackaged: true, fetchReleases: async () => releases }).checkForUpdates()).status).toBe('idle');
    const failing = await createUpdater({ ...base, isPackaged: true, fetchReleases: async () => { throw new Error('offline'); } }).checkForUpdates();
    expect(failing).toMatchObject({ status: 'error', message: 'offline' });
    expect((await createUpdater({ ...base, isPackaged: false }).checkForUpdates()).canSelfInstall).toBe(false);
  });

  it('self-installs via electron-updater on Windows with the beta channel', async () => {
    const handlers = new Map<string, (...a: unknown[]) => void>();
    const fake: AutoUpdaterLike = {
      autoDownload: false, autoInstallOnAppQuit: false, allowPrerelease: false, channel: null, allowDowngrade: false, logger: null,
      on: (event, listener) => { handlers.set(event, listener); },
      checkForUpdates: async () => { handlers.get('update-available')?.({ version: '1.0.0-beta.4' }); handlers.get('update-downloaded')?.({ version: '1.0.0-beta.4' }); },
      quitAndInstall: vi.fn()
    };
    const updater = createUpdater({ currentVersion: '1.0.0-beta.1', isPackaged: true, platform: 'win32', loadAutoUpdater: () => fake, openExternalUrl: async () => undefined, onStatus: () => undefined });
    const info = await updater.checkForUpdates();
    expect(info).toEqual({ status: 'downloaded', canSelfInstall: true, version: '1.0.0-beta.4' });
    expect(fake.channel).toBe('beta');
    expect(fake.allowPrerelease).toBe(true);
    await updater.installDownloadedUpdate();
    expect(fake.quitAndInstall).toHaveBeenCalled();
  });
});

describe('shell handoff', () => {
  it('only allows http(s) URLs', () => {
    expect(parseSafeExternalUrl('https://github.com/team-aie/app').hostname).toBe('github.com');
    expect(parseSafeExternalUrl('http://example.com').protocol).toBe('http:');
    for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'vscode://x', 'nope', 42]) {
      expect(() => parseSafeExternalUrl(bad)).toThrow();
    }
  });

  it('discovers standard install locations per platform', () => {
    expect(discoverToolCandidates('vlabeler', 'darwin', {}, '/Users/j')).toContain('/Applications/vLabeler.app');
    expect(discoverToolCandidates('openutau', 'win32', { LOCALAPPDATA: 'C:\\L' }, 'C:\\h')[0]).toBe('C:\\L\\Programs\\OpenUtau\\OpenUtau.exe');
    expect(discoverToolCandidates('openutau', 'linux', { PATH: '/usr/bin' }, '/h')).toContain('/usr/bin/OpenUtau');
  });

  it('launches the configured tool, reports missing tools, and rejects bad folders', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aie-shell-'));
    const exe = path.join(dir, 'vlabeler');
    fs.writeFileSync(exe, '#!/bin/sh');
    const launch = vi.fn(async () => undefined);
    const settings = { ...createDefaultSettings(), externalTools: { vLabelerPath: exe, openUtauPath: '' } };
    const shell = { showItemInFolder: vi.fn(), openPath: vi.fn(async () => ''), openExternal: vi.fn(async () => undefined) };
    const handoff = createShellHandoff({ shell, getSettings: () => settings, platform: 'linux', env: { PATH: '' }, homeDir: dir, launch });
    expect(await handoff.openInExternalTool({ tool: 'vlabeler', projectRootPath: dir })).toEqual({ ok: true });
    expect(launch).toHaveBeenCalledWith(exe, [], dir);
    const missing = await handoff.openInExternalTool({ tool: 'openutau', projectRootPath: dir });
    expect(missing.ok).toBe(false);
    expect(missing.error).toMatch(/OpenUtau was not found/);
    expect((await handoff.openInExternalTool({ tool: 'vlabeler', projectRootPath: path.join(dir, 'nope') })).ok).toBe(false);

    await handoff.revealInFileManager(path.join(dir, 'not-yet', 'a.wav'));
    expect(shell.openPath).toHaveBeenCalledWith(dir);
    await handoff.revealInFileManager(exe);
    expect(shell.showItemInFolder).toHaveBeenCalledWith(exe);
    await expect(handoff.revealInFileManager('relative/x')).rejects.toThrow();
    await expect(handoff.openExternalUrl('file:///x')).rejects.toThrow();
    await handoff.openExternalUrl('https://example.com/a');
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/a');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('domain services adapter', () => {
  it('uses stubs when domain-core modules are missing', async () => {
    const d = createDomainServices({ trashItem: async () => undefined, modules: { voicebank: {}, project: {} } });
    expect(d.available).toEqual({ voicebank: false, project: false });
    expect(await d.voicebank.listBuiltinReclists()).toEqual([]);
    await expect(d.project.openProject('/x')).rejects.toThrow(/not available/);
  });

  it('binds real modules and trashes set wavs through the OS before deleting', async () => {
    const trashItem = vi.fn(async () => undefined);
    const deleteRecordingSet = vi.fn(async (p: unknown) => ({ deleted: p }));
    const d = createDomainServices({
      trashItem,
      modules: {
        voicebank: { loadRecordingList: async () => 'bundle' },
        project: {
          openProject: async () => ({ sets: [{ id: 's', targetLocation: 'subfolder', subfolderName: 'G4' }] }),
          getSetProgress: async () => ({ recordedFileNames: ['a.wav', '../evil.wav'] }),
          deleteRecordingSet
        }
      }
    });
    expect(d.available).toEqual({ voicebank: true, project: true });
    await d.project.deleteRecordingSet({ rootPath: '/root', setId: 's', trashWavFiles: true });
    expect(trashItem).toHaveBeenCalledTimes(1);
    expect(trashItem).toHaveBeenCalledWith(path.resolve('/root', 'G4', 'a.wav'));
    expect(deleteRecordingSet).toHaveBeenCalledWith({ rootPath: '/root', setId: 's', trashWavFiles: false });
  });
});
