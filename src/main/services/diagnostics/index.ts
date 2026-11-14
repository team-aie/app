import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, BrowserWindow, dialog, shell } from 'electron';
import log from 'electron-log/main';
import type { AppSettings, DiagnosticExportResult, OssLicenseEntry } from '@shared/types';
import { readOssLicenses } from './oss-licenses';
import { createHomeScrubber, RingBuffer, scrubValue, type Scrubber, type TelemetryEntry } from './scrub';
import { buildDiagnosticZip, diagnosticZipFileName, type SystemInfo } from './zip';

export { createHomeScrubber, scrubValue, RingBuffer } from './scrub';
export { buildDiagnosticZip, diagnosticZipFileName, sanitizeSettings } from './zip';
export { collectOssLicenses, readOssLicenses } from './oss-licenses';

export const LOG_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const TELEMETRY_CAPACITY = 100;

const telemetry = new RingBuffer<TelemetryEntry>(TELEMETRY_CAPACITY);
let scrub: Scrubber = createHomeScrubber(os.homedir());
let initialized = false;

export interface Diagnostics {
  logger: typeof log;
  logsDir: string;
  scrub: Scrubber;
  exportDiagnosticZip(): Promise<DiagnosticExportResult>;
  toggleDevTools(): Promise<void>;
  getOssLicenses(): Promise<OssLicenseEntry[]>;
  openChromiumNotices(): Promise<void>;
  /** Pushes an arbitrary scrubbed event (e.g. audio-device telemetry) into the 100-entry ring buffer. */
  recordEvent(level: string, message: string): void;
  recentEvents(): TelemetryEntry[];
}

export interface DiagnosticsOptions {
  getSettings: () => AppSettings;
  getMainWindow: () => BrowserWindow | null;
  homeDir?: string;
}

/** Configures `electron-log` v5: 5 MB rotation, `$HOME` -> `~` scrubbing, in-memory ring buffer. */
export function initDiagnostics(options: DiagnosticsOptions): Diagnostics {
  scrub = createHomeScrubber(options.homeDir ?? os.homedir());
  const logsDir = path.join(app.getPath('userData'), 'logs');

  if (!initialized) {
    initialized = true;
    log.transports.file.resolvePathFn = () => path.join(logsDir, 'main.log');
    log.transports.file.maxSize = LOG_MAX_SIZE_BYTES; // rotates to main.old.log
    log.transports.file.level = 'info';
    log.transports.console.level = app.isPackaged ? 'warn' : 'debug';
    log.hooks.push((message, _transport, transportName) => {
      message.data = message.data.map((d) => scrubValue(d, scrub));
      if (transportName === 'file') {
        telemetry.push({
          at: message.date.toISOString(),
          level: message.level,
          message: message.data.map((d) => (typeof d === 'string' ? d : JSON.stringify(d))).join(' ')
        });
      }
      return message;
    });
    log.errorHandler.startCatching({ showDialog: false });
  }

  const recordEvent = (level: string, message: string): void => {
    telemetry.push({ at: new Date().toISOString(), level, message: scrub(message) });
  };

  const focusedWindow = (): BrowserWindow | null =>
    BrowserWindow.getFocusedWindow() ?? options.getMainWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

  return {
    logger: log,
    logsDir,
    scrub,
    recordEvent,
    recentEvents: () => telemetry.toArray(),

    async exportDiagnosticZip() {
      const parent = options.getMainWindow();
      const saveOptions = {
        title: 'Export Diagnostic Zip',
        defaultPath: path.join(app.getPath('downloads'), diagnosticZipFileName()),
        filters: [{ name: 'Zip archive', extensions: ['zip'] }]
      };
      const result = parent
        ? await dialog.showSaveDialog(parent, saveOptions)
        : await dialog.showSaveDialog(saveOptions);
      if (result.canceled || !result.filePath) return { canceled: true };

      const systemInfo: SystemInfo = {
        generatedAt: new Date().toISOString(),
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron ?? '',
        chromeVersion: process.versions.chrome ?? '',
        nodeVersion: process.versions.node,
        platform: process.platform,
        osRelease: os.release(),
        arch: process.arch,
        systemLocale: app.getLocale(),
        settings: options.getSettings()
      };
      const zip = await buildDiagnosticZip({
        logsDir,
        systemInfo,
        recentEvents: telemetry.toArray(),
        scrub
      });
      await fs.promises.writeFile(result.filePath, zip);
      log.info('Diagnostic zip exported');
      return { canceled: false, zipPath: result.filePath };
    },

    async toggleDevTools() {
      const win = focusedWindow();
      if (!win || win.isDestroyed()) return;
      if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
      else win.webContents.openDevTools({ mode: 'detach' });
    },

    async getOssLicenses() {
      return readOssLicenses({
        compiledPath: path.join(import.meta.dirname, '../oss-licenses.json'),
        appRoot: app.getAppPath()
      });
    },

    async openChromiumNotices() {
      const execDir = path.dirname(process.execPath);
      const candidates = [
        path.join(process.resourcesPath ?? '', 'LICENSES.chromium.html'),
        path.join(execDir, 'LICENSES.chromium.html'),
        path.join(
          execDir,
          '..',
          'Frameworks',
          'Electron Framework.framework',
          'Resources',
          'LICENSES.chromium.html'
        ),
        path.join(app.getAppPath(), 'node_modules', 'electron', 'dist', 'LICENSES.chromium.html')
      ];
      const found = candidates.find((c) => fs.existsSync(c));
      if (found) {
        const error = await shell.openPath(found);
        if (error === '') return;
        log.warn('Could not open Chromium notices file', error);
      }
      await shell.openExternal('https://github.com/electron/electron/blob/main/LICENSE');
    }
  };
}

/** `true` when the process was launched with `--debug` (DevTools auto-open). */
export function isDebugLaunch(argv: readonly string[] = process.argv): boolean {
  return argv.includes('--debug');
}
