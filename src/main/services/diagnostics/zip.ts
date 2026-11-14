import fs from 'node:fs';
import path from 'node:path';
import { strToU8, zipSync, type Zippable } from 'fflate';
import type { AppSettings } from '@shared/types';
import type { Scrubber, TelemetryEntry } from './scrub';

export interface SystemInfo {
  generatedAt: string;
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  platform: string;
  osRelease: string;
  arch: string;
  systemLocale: string;
  settings: AppSettings;
}

/** Drops hardware identifiers and scrubs tool paths so the zip is safe to attach to a public issue. */
export function sanitizeSettings(settings: AppSettings, scrub: Scrubber): AppSettings {
  const redactDevice = (id: string): string => (id === '' || id === 'default' ? id : '[redacted-device-id]');
  return {
    ...settings,
    inputDeviceId: redactDevice(settings.inputDeviceId),
    outputDeviceId: redactDevice(settings.outputDeviceId),
    externalTools: {
      vLabelerPath: scrub(settings.externalTools.vLabelerPath),
      openUtauPath: scrub(settings.externalTools.openUtauPath)
    }
  };
}

export interface DiagnosticZipInput {
  logsDir: string;
  systemInfo: SystemInfo;
  recentEvents: TelemetryEntry[];
  scrub: Scrubber;
}

/** Reads every `*.log` in `logsDir` (rotated `main.log`, `main.old.log`, ...) and scrubs it again defensively. */
export async function readScrubbedLogs(
  logsDir: string,
  scrub: Scrubber
): Promise<Array<{ name: string; content: string }>> {
  let names: string[];
  try {
    names = (await fs.promises.readdir(logsDir)).filter((n) => n.toLowerCase().endsWith('.log'));
  } catch {
    return [];
  }
  const logs: Array<{ name: string; content: string }> = [];
  for (const name of names.sort()) {
    try {
      const content = await fs.promises.readFile(path.join(logsDir, name), 'utf8');
      logs.push({ name, content: scrub(content) });
    } catch {
      // A log file rotating away mid-export is not worth failing the whole export.
    }
  }
  return logs;
}

/** Builds the pure-TS diagnostic `.zip` (no native deps, no network). */
export async function buildDiagnosticZip(input: DiagnosticZipInput): Promise<Uint8Array> {
  const logs = await readScrubbedLogs(input.logsDir, input.scrub);
  const files: Zippable = {
    'system-info.json': strToU8(
      JSON.stringify(
        { ...input.systemInfo, settings: sanitizeSettings(input.systemInfo.settings, input.scrub) },
        null,
        2
      )
    ),
    'recent-events.json': strToU8(JSON.stringify(input.recentEvents, null, 2))
  };
  for (const log of logs) files[`logs/${log.name}`] = strToU8(log.content);
  return zipSync(files, { level: 6 });
}

export function diagnosticZipFileName(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `aie-diagnostics-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.zip`;
}
