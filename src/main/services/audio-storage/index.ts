import fs from 'node:fs';
import path from 'node:path';
import type { RecordedTakePayload, SavedTakeSummary } from '@shared/types';
import { analyzeTake, decodeWav, encodeWav } from './wav-codec';
import { resolveTakePaths, type TakeLocation } from './safe-path';

export { UnsafePathError, resolveTakePaths } from './safe-path';
export { watchWavDirectory, listWavFileNames } from './directory-watcher';

export interface AudioStorageOptions {
  /** Moves a file to the OS Trash (Electron `shell.trashItem`). Never falls back to `unlink`. */
  trashItem: (targetPath: string) => Promise<void>;
}

export interface AudioStorage {
  saveTake(payload: RecordedTakePayload): Promise<SavedTakeSummary>;
  readTakeSamples(location: TakeLocation): Promise<{ samples: Float32Array; sampleRate: number } | null>;
  undoLastRetake(location: TakeLocation): Promise<boolean>;
  trashTake(location: TakeLocation): Promise<void>;
}

const exists = (p: string): Promise<boolean> =>
  fs.promises.access(p).then(
    () => true,
    () => false
  );

async function writeFileAtomic(target: string, bytes: Uint8Array): Promise<void> {
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  try {
    await fs.promises.writeFile(tmp, bytes);
    await fs.promises.rename(tmp, target);
  } catch (error) {
    await fs.promises.rm(tmp, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function createAudioStorage(options: AudioStorageOptions): AudioStorage {
  return {
    async saveTake(payload) {
      if (!(payload.samples instanceof Float32Array) || payload.samples.length === 0) {
        throw new Error('Cannot save an empty take');
      }
      const { directory, wavPath, undoPath } = resolveTakePaths(payload);
      // Encode first: if encoding throws, the previous take is left completely untouched.
      const bytes = encodeWav(payload.samples, payload.format);
      await fs.promises.mkdir(directory, { recursive: true });

      if (await exists(wavPath)) {
        // 1-step undo: keep the take we are about to overwrite.
        await fs.promises.mkdir(path.dirname(undoPath), { recursive: true });
        await fs.promises.copyFile(wavPath, undoPath);
      } else {
        // First take for this prompt: a stale backup of an older take must not be undoable.
        await fs.promises.rm(undoPath, { force: true });
      }
      await writeFileAtomic(wavPath, bytes);

      // Analyse what was actually written (post DC-removal), not the raw input.
      const analysed = decodeWav(bytes);
      const analysis = analyzeTake(analysed.samples, payload.format.sampleRate);
      return {
        fullPath: wavPath,
        ...analysis,
        canUndoPreviousTake: await exists(undoPath)
      };
    },

    async readTakeSamples(location) {
      const { wavPath } = resolveTakePaths(location);
      let bytes: Buffer;
      try {
        bytes = await fs.promises.readFile(wavPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
      return decodeWav(bytes);
    },

    async undoLastRetake(location) {
      const { wavPath, undoPath } = resolveTakePaths(location);
      if (!(await exists(undoPath))) return false;
      await fs.promises.mkdir(path.dirname(wavPath), { recursive: true });
      await fs.promises.rename(undoPath, wavPath);
      return true;
    },

    async trashTake(location) {
      const { wavPath } = resolveTakePaths(location);
      if (!(await exists(wavPath))) return;
      await options.trashItem(wavPath);
    }
  };
}
