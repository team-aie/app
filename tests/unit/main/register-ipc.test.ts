// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_SINGER_FILES,
  type AieProjectManifest,
  type RecordingSetConfig,
  type SingerFileSelection
} from '@shared/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0'
  },
  BrowserWindow: {
    getAllWindows: () => []
  },
  dialog: {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] }))
  },
  ipcMain: {
    handle: vi.fn((channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, fn);
    }),
    removeHandler: vi.fn((channel: string) => {
      ipcHandlers.delete(channel);
    })
  }
}));

import { IPC } from '../../../src/preload/channels';
import { createDomainServices } from '../../../src/main/ipc/domain-services-adapter';
import { registerIpc } from '../../../src/main/ipc/register-ipc';
import { createAppStateStore } from '../../../src/main/services/app-state';
import { createAudioStorage } from '../../../src/main/services/audio-storage';

let tempRoot: string;
let disposeIpc: (() => void) | null = null;

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    return (await fs.stat(targetPath)).isFile();
  } catch {
    return false;
  }
}

async function invokeIpc<T>(channel: string, ...args: unknown[]): Promise<T> {
  const handler = ipcHandlers.get(channel);
  if (!handler) {
    throw new Error(`Missing IPC handler for ${channel}`);
  }
  return (await handler({ sender: { id: 1, isDestroyed: () => false, once: vi.fn(), send: vi.fn() } }, ...args)) as T;
}

beforeEach(async () => {
  ipcHandlers.clear();
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aie-register-ipc-'));
  const appState = createAppStateStore({
    filePath: path.join(tempRoot, 'state', 'app-state.json')
  });
  const trashItem = vi.fn(async (targetPath: string) => {
    await fs.rm(targetPath, { force: true });
  });
  const domain = createDomainServices({ trashItem });
  const audioStorage = createAudioStorage({ trashItem });

  disposeIpc = registerIpc({
    appState,
    domain,
    audioStorage,
    diagnostics: {
      exportDiagnosticZip: async () => ({ canceled: true }),
      toggleDevTools: async () => undefined,
      getOssLicenses: async () => [],
      openChromiumNotices: async () => undefined
    },
    shellHandoff: {
      revealInFileManager: async () => undefined,
      openInExternalTool: async () => ({ ok: true }),
      openExternalUrl: async () => undefined
    },
    updater: {
      getStatus: () => ({ status: 'idle', canSelfInstall: false }),
      checkForUpdates: async () => ({ status: 'idle', canSelfInstall: false }),
      installDownloadedUpdate: async () => undefined
    },
    getMainWindow: () => null,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  });
});

afterEach(async () => {
  disposeIpc?.();
  disposeIpc = null;
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe('registerIpc — project singerFiles forwarding & payload validation', () => {
  it('forwards singerFiles across createProject, openProject, saveProject, upsertRecordingSet, deleteRecordingSet, and syncSingerScaffolding', async () => {
    const combos: Array<{ name: string; singerFiles?: SingerFileSelection; expected: SingerFileSelection }> = [
      {
        name: 'txt-only',
        singerFiles: { characterTxt: true, characterYaml: false, prefixMap: false },
        expected: { characterTxt: true, characterYaml: false, prefixMap: false }
      },
      {
        name: 'yaml-only',
        singerFiles: { characterTxt: false, characterYaml: true, prefixMap: false },
        expected: { characterTxt: false, characterYaml: true, prefixMap: false }
      },
      {
        name: 'none',
        singerFiles: { characterTxt: false, characterYaml: false, prefixMap: false },
        expected: { characterTxt: false, characterYaml: false, prefixMap: false }
      },
      {
        name: 'all-three',
        singerFiles: undefined,
        expected: DEFAULT_SINGER_FILES
      }
    ];

    for (const combo of combos) {
      const projDir = path.join(tempRoot, combo.name);
      const manifest = await invokeIpc<AieProjectManifest>(IPC.project.createProject, {
        name: `IPC ${combo.name}`,
        rootPath: projDir,
        author: 'IPC Tester',
        ...(combo.singerFiles ? { singerFiles: combo.singerFiles } : {})
      });

      expect(manifest.singerFiles).toEqual(combo.expected);
      expect(await fileExists(path.join(projDir, 'character.txt'))).toBe(combo.expected.characterTxt);
      expect(await fileExists(path.join(projDir, 'character.yaml'))).toBe(combo.expected.characterYaml);
      expect(await fileExists(path.join(projDir, 'prefix.map'))).toBe(combo.expected.prefixMap);

      const reopened = await invokeIpc<AieProjectManifest>(IPC.project.openProject, projDir);
      expect(reopened.singerFiles).toEqual(combo.expected);
    }

    // Verify later unchecking via saveProject + upsertRecordingSet + deleteRecordingSet keeps existing files untouched
    const allDir = path.join(tempRoot, 'all-three');
    const current = await invokeIpc<AieProjectManifest>(IPC.project.openProject, allDir);
    await fs.writeFile(path.join(allDir, 'prefix.map'), 'CUSTOM_PREFIX_MAP\n', 'utf8');

    const updated = await invokeIpc<AieProjectManifest>(IPC.project.saveProject, {
      ...current,
      name: 'IPC Updated',
      singerFiles: {
        characterTxt: true,
        characterYaml: true,
        prefixMap: false
      }
    });
    expect(updated.singerFiles).toEqual({
      characterTxt: true,
      characterYaml: true,
      prefixMap: false
    });

    const setCfg: RecordingSetConfig = {
      id: 'set-c4',
      name: 'Normal C4',
      targetLocation: 'subfolder',
      subfolderName: 'C4',
      scale: 'C4',
      aliasSuffix: '_C4',
      reclistSource: { kind: 'builtin', builtinId: 'dv_jpn_list_by_alex' },
      guideAudio: { kind: 'none' },
      generateCompanionFiles: true,
      lastCursorIndex: 0,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };

    const withSet = await invokeIpc<AieProjectManifest>(
      IPC.project.upsertRecordingSet,
      allDir,
      setCfg
    );
    expect(withSet.singerFiles?.prefixMap).toBe(false);
    expect(await fs.readFile(path.join(allDir, 'prefix.map'), 'utf8')).toBe('CUSTOM_PREFIX_MAP\n');

    await invokeIpc<void>(IPC.voicebank.syncSingerScaffolding, withSet);
    expect(await fs.readFile(path.join(allDir, 'prefix.map'), 'utf8')).toBe('CUSTOM_PREFIX_MAP\n');

    const afterDelete = await invokeIpc<AieProjectManifest>(IPC.project.deleteRecordingSet, {
      rootPath: allDir,
      setId: 'set-c4',
      trashWavFiles: false
    });
    expect(afterDelete.singerFiles?.prefixMap).toBe(false);
    expect(await fs.readFile(path.join(allDir, 'prefix.map'), 'utf8')).toBe('CUSTOM_PREFIX_MAP\n');
  });

  it('rejects malformed singerFiles payloads over IPC', async () => {
    await expect(
      invokeIpc(IPC.project.createProject, {
        name: 'Bad Payload',
        rootPath: path.join(tempRoot, 'bad-1'),
        singerFiles: 'not-an-object'
      })
    ).rejects.toThrow(/singerFiles must be an object/);

    await expect(
      invokeIpc(IPC.project.createProject, {
        name: 'Bad Bool',
        rootPath: path.join(tempRoot, 'bad-2'),
        singerFiles: {
          characterTxt: 'yes',
          characterYaml: true,
          prefixMap: true
        }
      })
    ).rejects.toThrow(/singerFiles\.characterTxt must be a boolean/);
  });
});
