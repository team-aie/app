import path from 'node:path';
import type { AieBridgeApi } from '@shared/types';
import { isInside } from '../services/audio-storage/safe-path';

/**
 * Seam with `domain-core`: binds `src/main/services/{voicebank,project}/index.ts`
 * when they exist (resolved at build time by `import.meta.glob`, so a missing
 * module never breaks `tsc`/`electron-vite build`) and falls back to stubs that
 * reject with a clear error until that workstream is merged.
 */
export type VoicebankService = AieBridgeApi['voicebank'];
export type ProjectService = Pick<
  AieBridgeApi['project'],
  | 'createProject'
  | 'openProject'
  | 'saveProject'
  | 'upsertRecordingSet'
  | 'deleteRecordingSet'
  | 'getSetProgress'
>;

type Loose = Record<string, unknown>;

const voicebankGlob = import.meta.glob<Loose>('../services/voicebank/index.ts', { eager: true });
const projectGlob = import.meta.glob<Loose>('../services/project/index.ts', { eager: true });

export interface DomainServices {
  voicebank: VoicebankService;
  project: ProjectService;
  available: { voicebank: boolean; project: boolean };
}

export interface DomainServicesOptions {
  /** Electron `shell.trashItem`: used so deleting a set never permanently unlinks `.wav` files. */
  trashItem: (targetPath: string) => Promise<void>;
  /** Test seam: replaces the build-time discovered modules. */
  modules?: { voicebank?: Loose; project?: Loose };
}

function bind<T extends (...args: never[]) => unknown>(mod: Loose | undefined, name: string): T {
  const fn = mod?.[name];
  if (typeof fn === 'function') return ((...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(...args)) as unknown as T;
  return ((): Promise<never> =>
    Promise.reject(new Error(`domain-core service "${name}" is not available yet`))) as unknown as T;
}

export function createDomainServices(options: DomainServicesOptions): DomainServices {
  const vbMod = options.modules?.voicebank ?? Object.values(voicebankGlob)[0];
  const prMod = options.modules?.project ?? Object.values(projectGlob)[0];

  const voicebank: VoicebankService = {
    listBuiltinReclists:
      typeof vbMod?.['listBuiltinReclists'] === 'function'
        ? bind<VoicebankService['listBuiltinReclists']>(vbMod, 'listBuiltinReclists')
        : () => Promise.resolve([]),
    loadRecordingList: bind<VoicebankService['loadRecordingList']>(vbMod, 'loadRecordingList'),
    syncSingerScaffolding: bind<VoicebankService['syncSingerScaffolding']>(vbMod, 'syncSingerScaffolding')
  };

  const openProject = bind<ProjectService['openProject']>(prMod, 'openProject');
  const getSetProgress = bind<ProjectService['getSetProgress']>(prMod, 'getSetProgress');
  const domainDelete = bind<ProjectService['deleteRecordingSet']>(prMod, 'deleteRecordingSet');

  const project: ProjectService = {
    createProject: bind<ProjectService['createProject']>(prMod, 'createProject'),
    openProject,
    saveProject: bind<ProjectService['saveProject']>(prMod, 'saveProject'),
    upsertRecordingSet: bind<ProjectService['upsertRecordingSet']>(prMod, 'upsertRecordingSet'),
    getSetProgress,
    async deleteRecordingSet(params) {
      if (params.trashWavFiles) {
        // Trash through the OS here so the behaviour never depends on how the domain layer deletes.
        const manifest = await openProject(params.rootPath);
        const set = manifest.sets.find((s) => s.id === params.setId);
        if (set) {
          const progress = await getSetProgress(params.rootPath, set);
          const root = path.resolve(params.rootPath);
          const dir = set.targetLocation === 'root' ? root : path.resolve(root, set.subfolderName);
          if (isInside(root, dir)) {
            for (const fileName of progress.recordedFileNames) {
              if (fileName.includes('/') || fileName.includes('\\')) continue;
              await options.trashItem(path.join(dir, fileName));
            }
          }
        }
      }
      return domainDelete({ ...params, trashWavFiles: false });
    }
  };

  return {
    voicebank,
    project,
    available: {
      voicebank: typeof vbMod?.['loadRecordingList'] === 'function',
      project: typeof prMod?.['openProject'] === 'function'
    }
  };
}
