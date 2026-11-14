import { execFile } from 'node:child_process';
import path from 'node:path';
import type { UpdateStatusInfo } from '@shared/types';

export const GITHUB_OWNER = 'team-aie';
export const GITHUB_REPO = 'app';

/** `1.0.0-beta.2` / `-alpha.*` builds follow the `beta` channel; everything else is Stable. */
export function channelForVersion(version: string): 'latest' | 'beta' {
  return /-(beta|alpha)/i.test(version) ? 'beta' : 'latest';
}

interface ParsedVersion {
  core: [number, number, number];
  pre: Array<string | number>;
}

export function parseVersion(raw: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(raw.trim());
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : []
  };
}

/** Semver precedence: `-1` / `0` / `1`, or `null` when either side is not valid semver. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return null;
  for (let i = 0; i < 3; i++) {
    const diff = (va.core[i] ?? 0) - (vb.core[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  if (va.pre.length === 0 && vb.pre.length === 0) return 0;
  if (va.pre.length === 0) return 1;
  if (vb.pre.length === 0) return -1;
  for (let i = 0; i < Math.max(va.pre.length, vb.pre.length); i++) {
    const pa = va.pre[i];
    const pb = vb.pre[i];
    if (pa === undefined) return -1;
    if (pb === undefined) return 1;
    if (pa === pb) continue;
    if (typeof pa === 'number' && typeof pb === 'number') return pa < pb ? -1 : 1;
    if (typeof pa === 'number') return -1;
    if (typeof pb === 'number') return 1;
    return pa < pb ? -1 : 1;
  }
  return 0;
}

export interface GithubRelease {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

/** Picks the newest published release visible to `channel` (Stable ignores prereleases). */
export function pickLatestRelease(releases: GithubRelease[], channel: 'latest' | 'beta'): GithubRelease | null {
  let best: GithubRelease | null = null;
  for (const release of releases) {
    if (release.draft || (channel === 'latest' && release.prerelease)) continue;
    if (!parseVersion(release.tag_name)) continue;
    if (!best || compareVersions(release.tag_name, best.tag_name) === 1) best = release;
  }
  return best;
}

/** Minimal surface of `electron-updater`'s `AppUpdater` used here (lets tests inject a fake). */
export interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  channel: string | null;
  allowDowngrade: boolean;
  logger: unknown;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
}

export interface UpdaterOptions {
  currentVersion: string;
  isPackaged: boolean;
  platform?: NodeJS.Platform;
  /** Lazy loader so `electron-updater` is never touched in dev / fallback mode. */
  loadAutoUpdater: () => AutoUpdaterLike;
  fetchReleases?: (owner: string, repo: string) => Promise<GithubRelease[]>;
  /** `true` when the running macOS build has a Developer ID signature (required by Squirrel.Mac). */
  isMacSigned?: () => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<void>;
  onStatus: (info: UpdateStatusInfo) => void;
  logger?: { info(...a: unknown[]): void; warn(...a: unknown[]): void; error(...a: unknown[]): void };
}

export interface UpdaterService {
  checkForUpdates(): Promise<UpdateStatusInfo>;
  installDownloadedUpdate(): Promise<void>;
  getStatus(): UpdateStatusInfo;
}

export async function fetchGithubReleases(owner: string, repo: string): Promise<GithubRelease[]> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=30`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aie-updater' },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`GitHub Releases responded ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected GitHub Releases payload');
  return data.flatMap((r): GithubRelease[] => {
    const rec = r as Record<string, unknown>;
    return typeof rec['tag_name'] === 'string' && typeof rec['html_url'] === 'string'
      ? [
          {
            tag_name: rec['tag_name'],
            html_url: rec['html_url'],
            draft: rec['draft'] === true,
            prerelease: rec['prerelease'] === true
          }
        ]
      : [];
  });
}

/** Developer ID check via `codesign -dvv` on the enclosing `.app` bundle (ad-hoc/unsigned => `false`). */
export function detectMacSigned(execPath: string = process.execPath): Promise<boolean> {
  const segments = execPath.split(path.sep);
  const appIndex = segments.findIndex((segment) => segment.endsWith('.app'));
  const bundlePath = appIndex === -1 ? '' : segments.slice(0, appIndex + 1).join(path.sep);
  if (bundlePath === '') return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile('codesign', ['-dvv', bundlePath], { timeout: 10_000 }, (error, stdout, stderr) => {
      resolve(!error && /Authority=Developer ID Application/.test(`${stdout}${stderr}`));
    });
  });
}

export function createUpdater(options: UpdaterOptions): UpdaterService {
  const platform = options.platform ?? process.platform;
  const channel = channelForVersion(options.currentVersion);
  const fetchReleases = options.fetchReleases ?? fetchGithubReleases;
  const isMacSigned = options.isMacSigned ?? (() => detectMacSigned());
  let status: UpdateStatusInfo = { status: 'idle', canSelfInstall: false };
  let selfInstall: Promise<boolean> | null = null;
  let wired: AutoUpdaterLike | null = null;

  const publish = (next: UpdateStatusInfo): UpdateStatusInfo => {
    status = next;
    options.onStatus(next);
    return next;
  };

  const canSelfInstall = (): Promise<boolean> => {
    selfInstall ??= (async () => {
      if (!options.isPackaged) return false;
      if (platform === 'darwin') return isMacSigned();
      return platform === 'win32' || platform === 'linux';
    })();
    return selfInstall;
  };

  const wireAutoUpdater = (): AutoUpdaterLike => {
    if (wired) return wired;
    const updater = options.loadAutoUpdater();
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowDowngrade = false;
    updater.channel = channel;
    updater.allowPrerelease = channel === 'beta';
    updater.logger = options.logger ?? null;
    updater.on('checking-for-update', () => publish({ status: 'checking', canSelfInstall: true }));
    updater.on('update-available', (info) =>
      publish({
        status: 'available',
        canSelfInstall: true,
        version: (info as { version?: string } | undefined)?.version,
        message: 'Downloading update...'
      })
    );
    updater.on('update-not-available', () => publish({ status: 'idle', canSelfInstall: true }));
    updater.on('update-downloaded', (info) =>
      publish({
        status: 'downloaded',
        canSelfInstall: true,
        version: (info as { version?: string } | undefined)?.version
      })
    );
    updater.on('error', (error) =>
      publish({
        status: 'error',
        canSelfInstall: true,
        message: error instanceof Error ? error.message : String(error)
      })
    );
    wired = updater;
    return updater;
  };

  const checkViaGithub = async (): Promise<UpdateStatusInfo> => {
    publish({ status: 'checking', canSelfInstall: false });
    const releases = await fetchReleases(GITHUB_OWNER, GITHUB_REPO);
    const latest = pickLatestRelease(releases, channel);
    if (latest && compareVersions(latest.tag_name, options.currentVersion) === 1) {
      return publish({
        status: 'available',
        canSelfInstall: false,
        version: latest.tag_name.replace(/^v/, ''),
        releaseUrl: latest.html_url
      });
    }
    return publish({ status: 'idle', canSelfInstall: false });
  };

  return {
    getStatus: () => status,

    async checkForUpdates() {
      if (!options.isPackaged) {
        return publish({
          status: 'idle',
          canSelfInstall: false,
          message: 'Updates are disabled in development builds'
        });
      }
      try {
        if (await canSelfInstall()) {
          await wireAutoUpdater().checkForUpdates();
          return status; // events above already published the outcome
        }
        return await checkViaGithub();
      } catch (error) {
        options.logger?.warn('Update check failed', error);
        return publish({
          status: 'error',
          canSelfInstall: await canSelfInstall().catch(() => false),
          message: error instanceof Error ? error.message : String(error)
        });
      }
    },

    async installDownloadedUpdate() {
      if (status.status === 'downloaded' && status.canSelfInstall && wired) {
        wired.quitAndInstall();
        return;
      }
      // Unsigned macOS (or dev): hand the user to the GitHub release page instead.
      if (status.releaseUrl) await options.openExternalUrl(status.releaseUrl);
    }
  };
}
