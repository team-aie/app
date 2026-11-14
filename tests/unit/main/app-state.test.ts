// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAppStateStore,
  createDefaultSettings,
  mapSystemLocale,
  MAX_RECENT_PROJECTS
} from '../../../src/main/services/app-state';

let dir: string;
let file: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aie-state-'));
  file = path.join(dir, 'nested', 'app-state.json');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('app-state', () => {
  it('maps system locales to supported locales', () => {
    expect(mapSystemLocale('zh-TW')).toBe('zh-CN');
    expect(mapSystemLocale('ja')).toBe('ja-JP');
    expect(mapSystemLocale('en-GB')).toBe('en-US');
    expect(mapSystemLocale('fr-FR')).toBe('en-US');
    expect(mapSystemLocale(undefined)).toBe('en-US');
  });

  it('starts from sensible defaults', () => {
    const s = createAppStateStore({ filePath: file, systemLocale: 'ja-JP' }).getSettings();
    expect(s).toEqual(createDefaultSettings('ja-JP'));
    expect(s.locale).toBe('ja-JP');
    expect(s.wavFormat).toEqual({ sampleRate: 44100, bitDepth: 16, removeDcOffset: true });
    expect(s.workflow.recordMode).toBe('hold');
    expect(s.workflow.guideEnabled).toBe(true);
    expect(s.workflow.showOtoGrid).toBe(true);
  });

  it('persists settings atomically and reloads them', async () => {
    const store = createAppStateStore({ filePath: file });
    const updated = await store.updateSettings({
      theme: 'dark',
      wavFormat: { bitDepth: 24 },
      workflow: { recordMode: 'toggle' }
    });
    expect(updated.wavFormat).toEqual({ sampleRate: 44100, bitDepth: 24, removeDcOffset: true });
    expect(fs.readdirSync(path.dirname(file)).filter((n) => n.endsWith('.tmp'))).toEqual([]);

    const reloaded = createAppStateStore({ filePath: file }).getSettings();
    expect(reloaded.theme).toBe('dark');
    expect(reloaded.wavFormat.bitDepth).toBe(24);
    expect(reloaded.workflow.recordMode).toBe('toggle');
  });

  it('ignores invalid values and survives a corrupt file', async () => {
    const store = createAppStateStore({ filePath: file });
    const s = await store.updateSettings({
      locale: 'xx',
      theme: 5,
      wavFormat: { sampleRate: 12345, bitDepth: 8 },
      workflow: { recordMode: 'nope', autoAdvanceDelayMs: 99999 }
    });
    expect(s).toEqual({ ...createDefaultSettings(), workflow: { ...createDefaultSettings().workflow, autoAdvanceDelayMs: 5000 } });
    fs.writeFileSync(file, '{not json');
    expect(createAppStateStore({ filePath: file }).getSettings()).toEqual(createDefaultSettings());
  });

  it('tracks recent projects, missing folders, and the cap', async () => {
    let tick = 0;
    const store = createAppStateStore({ filePath: file, now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)) });
    const real = path.join(dir, 'real');
    fs.mkdirSync(real);
    const project = (rootPath: string, name: string) => ({
      name,
      rootPath,
      activeSetId: 's1',
      sets: [{ id: 's1', name: 'Set 1', scale: 'G4' as const }]
    });
    await store.touchRecentProject(project(real, 'Real'));
    await store.touchRecentProject(project(path.join(dir, 'gone'), 'Gone'));
    await store.updateRecentProgress(real, { setId: 's1', recordedCount: 3, totalCount: 10, recordedFileNames: [] });
    await store.updateRecentProgress(real, { setId: 'other', recordedCount: 9, totalCount: 9, recordedFileNames: [] });

    let recents = await store.getRecentProjects();
    expect(recents.map((r) => r.name)).toEqual(['Gone', 'Real']);
    expect(recents[1]).toMatchObject({ recordedCount: 3, totalCount: 10, missingOnDisk: false, activeScale: 'G4' });
    expect(recents[0]?.missingOnDisk).toBe(true);

    await store.touchRecentProject(project(real, 'Real')); // re-open moves to top, keeps progress
    recents = await store.getRecentProjects();
    expect(recents[0]).toMatchObject({ name: 'Real', recordedCount: 3 });

    for (let i = 0; i < MAX_RECENT_PROJECTS + 3; i++) await store.touchRecentProject(project(path.join(dir, `p${i}`), `P${i}`));
    expect((await store.getRecentProjects()).length).toBe(MAX_RECENT_PROJECTS);

    await store.flush();
    const reloaded = createAppStateStore({ filePath: file });
    expect((await reloaded.getRecentProjects()).length).toBe(MAX_RECENT_PROJECTS);
  });
});
