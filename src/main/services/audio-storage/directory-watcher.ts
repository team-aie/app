import fs from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';

export interface DirectoryWatcherOptions {
  directory: string;
  onChanged: (recordedFileNames: string[]) => void;
  debounceMs?: number;
  /** How often to re-check for a directory that does not exist yet. */
  retryMs?: number;
  onError?: (error: unknown) => void;
}

export interface DirectoryWatcherHandle {
  close(): Promise<void>;
}

export async function listWavFileNames(directory: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.wav'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Debounced `.wav` watcher for one set directory. It never throws when the
 * directory is missing: it polls until the folder appears, then attaches chokidar.
 */
export function watchWavDirectory(options: DirectoryWatcherOptions): DirectoryWatcherHandle {
  const debounceMs = options.debounceMs ?? 150;
  const retryMs = options.retryMs ?? 1500;
  let closed = false;
  let watcher: FSWatcher | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;
  let retryTimer: NodeJS.Timeout | null = null;

  const emit = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void listWavFileNames(options.directory).then((names) => {
        if (!closed) options.onChanged(names);
      });
    }, debounceMs);
  };

  const attach = (): void => {
    if (closed) return;
    const isDirectory = fs.existsSync(options.directory) && fs.statSync(options.directory).isDirectory();
    if (!isDirectory) {
      retryTimer = setTimeout(attach, retryMs);
      return;
    }
    watcher = watch(options.directory, {
      depth: 0,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 }
    });
    const onFileEvent = (file: string): void => {
      if (file.toLowerCase().endsWith('.wav')) emit();
    };
    watcher.on('add', onFileEvent).on('change', onFileEvent).on('unlink', onFileEvent);
    watcher.on('error', (error) => options.onError?.(error));
    // A just-created directory may already contain files we missed while polling.
    if (retryTimer !== null) emit();
  };
  attach();

  return {
    async close() {
      closed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (retryTimer) clearTimeout(retryTimer);
      const w = watcher;
      watcher = null;
      await w?.close().catch(() => undefined);
    }
  };
}
