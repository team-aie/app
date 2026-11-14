import { spawn, type SpawnOptions } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AppSettings } from '@shared/types';

export type ExternalTool = 'vlabeler' | 'openutau';

/** Only plain web links may leave the app; `file:`, `javascript:`, custom schemes, etc. are rejected. */
export function parseSafeExternalUrl(raw: unknown): URL {
  if (typeof raw !== 'string') throw new Error('URL must be a string');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Blocked URL protocol: ${url.protocol}`);
  }
  return url;
}

const TOOL_LABEL: Record<ExternalTool, string> = { vlabeler: 'vLabeler', openutau: 'OpenUtau' };

/** Standard install locations + PATH names, most specific first (configured path is tried before these). */
export function discoverToolCandidates(
  tool: ExternalTool,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homeDir: string
): string[] {
  const app = TOOL_LABEL[tool];
  if (platform === 'darwin') {
    return [`/Applications/${app}.app`, path.join(homeDir, 'Applications', `${app}.app`)];
  }
  if (platform === 'win32') {
    const roots = [env['LOCALAPPDATA'], env['ProgramFiles'], env['ProgramFiles(x86)']].filter(
      (r): r is string => typeof r === 'string' && r !== ''
    );
    return roots.flatMap((root) => [
      path.win32.join(root, 'Programs', app, `${app}.exe`),
      path.win32.join(root, app, `${app}.exe`)
    ]);
  }
  const names = tool === 'vlabeler' ? ['vlabeler', 'vLabeler'] : ['OpenUtau', 'openutau'];
  const dirs = (env['PATH'] ?? '').split(path.delimiter).filter(Boolean);
  const onPath = dirs.flatMap((dir) => names.map((n) => path.join(dir, n)));
  return [...onPath, path.join(homeDir, 'Applications', `${app}.AppImage`), path.join(homeDir, app, app)];
}

export interface ShellLike {
  showItemInFolder(fullPath: string): void;
  openPath(targetPath: string): Promise<string>;
  openExternal(url: string): Promise<void>;
}

export interface ShellHandoffOptions {
  shell: ShellLike;
  getSettings: () => AppSettings;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  /** Test seam. Resolves once the child has spawned, rejects when it cannot start. */
  launch?: (command: string, args: string[], cwd: string) => Promise<void>;
}

export interface ShellHandoff {
  revealInFileManager(targetPath: string): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  openInExternalTool(params: {
    tool: ExternalTool;
    projectRootPath: string;
  }): Promise<{ ok: boolean; error?: string }>;
}

export function launchDetached(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const options: SpawnOptions = { cwd, detached: true, stdio: 'ignore' };
    const child = spawn(command, args, options);
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

const isFile = (p: string): boolean => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};
const isDirectory = (p: string): boolean => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

export function createShellHandoff(options: ShellHandoffOptions): ShellHandoff {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? os.homedir();
  const launch = options.launch ?? launchDetached;

  const resolveTool = (tool: ExternalTool): string | null => {
    const tools = options.getSettings().externalTools;
    const configured = (tool === 'vlabeler' ? tools.vLabelerPath : tools.openUtauPath).trim();
    // A .app bundle is a directory on macOS; everywhere else the tool must be a file.
    const usable = (p: string): boolean => (platform === 'darwin' ? fs.existsSync(p) : isFile(p));
    if (configured !== '' && usable(configured)) return configured;
    return discoverToolCandidates(tool, platform, env, homeDir).find(usable) ?? null;
  };

  return {
    async revealInFileManager(targetPath) {
      if (typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) {
        throw new Error('revealInFileManager requires an absolute path');
      }
      // Walk up so revealing a not-yet-recorded .wav still opens its folder.
      let current = path.resolve(targetPath);
      while (!fs.existsSync(current) && path.dirname(current) !== current) current = path.dirname(current);
      if (isDirectory(current)) {
        const error = await options.shell.openPath(current);
        if (error) throw new Error(error);
      } else {
        options.shell.showItemInFolder(current);
      }
    },

    async openExternalUrl(url) {
      await options.shell.openExternal(parseSafeExternalUrl(url).toString());
    },

    async openInExternalTool({ tool, projectRootPath }) {
      if (tool !== 'vlabeler' && tool !== 'openutau') return { ok: false, error: `Unknown tool: ${String(tool)}` };
      if (typeof projectRootPath !== 'string' || !isDirectory(projectRootPath)) {
        return { ok: false, error: 'Project folder does not exist' };
      }
      const label = TOOL_LABEL[tool];
      const executable = resolveTool(tool);
      if (!executable) {
        return { ok: false, error: `${label} was not found. Set its location in Settings > External tools.` };
      }
      try {
        // macOS: `open -a` launches the .app bundle; elsewhere run the binary in the project folder.
        if (platform === 'darwin') await launch('open', ['-a', executable], projectRootPath);
        else await launch(executable, [], projectRootPath);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: `Failed to launch ${label}: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
  };
}
