import { cleanup, render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll } from 'vitest';
import { createI18n } from '@shared/i18n';
import type {
  AieBridgeApi,
  AieProjectManifest,
  LocaleCode,
  ParsedRecordingListBundle,
  RecentProjectSummary,
  RecordingSetConfig
} from '@shared/types';
import { createFallbackBridge } from '@renderer/store/fallback-bridge';

/** jsdom lacks ResizeObserver (used by Radix Switch/Checkbox). */
export function installDomShims(): void {
  beforeAll(() => {
    if (!('ResizeObserver' in globalThis)) {
      class ResizeObserverStub {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
      (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
    }
  });
  afterEach(() => {
    cleanup();
  });
}

export function renderWithI18n(
  ui: ReactElement,
  locale: LocaleCode = 'en-US'
): RenderResult & { i18n: ReturnType<typeof createI18n> } {
  const i18n = createI18n({ locale, modules: [initReactI18next] });
  const result = render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
  return { ...result, i18n };
}

export const NOW_ISO = '2026-11-14T12:00:00.000Z';

export function makeSet(overrides: Partial<RecordingSetConfig> = {}): RecordingSetConfig {
  return {
    id: 'set-g4',
    name: 'Normal G4',
    targetLocation: 'subfolder',
    subfolderName: 'G4',
    scale: 'G4',
    aliasSuffix: '_G4',
    reclistSource: { kind: 'builtin', builtinId: 'z_cvvc_normal' },
    guideAudio: { kind: 'none' },
    generateCompanionFiles: true,
    lastCursorIndex: 3,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides
  };
}

export function makeManifest(overrides: Partial<AieProjectManifest> = {}): AieProjectManifest {
  return {
    schemaVersion: 1,
    id: 'project-teto',
    name: 'Kasane Teto',
    rootPath: '/voicebanks/teto',
    author: 'Twindrill',
    sets: [makeSet()],
    activeSetId: 'set-g4',
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides
  };
}

export function makeRecent(overrides: Partial<RecentProjectSummary> = {}): RecentProjectSummary {
  return {
    projectPath: '/voicebanks/teto',
    name: 'Kasane Teto',
    lastOpenedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    activeSetName: 'Normal G4',
    activeScale: 'G4',
    recordedCount: 142,
    totalCount: 365,
    missingOnDisk: false,
    ...overrides
  };
}

export function makeBundle(count = 6): ParsedRecordingListBundle {
  return {
    entries: Array.from({ length: count }, (_, index) => ({
      index,
      rawPrompt: `_ka_ki_ku_${index}`,
      fileStem: `_ka_ki_ku_${index}`,
      fileName: `_ka_ki_ku_${index}.wav`,
      pronunciationHint: index === 0 ? '[k a] [k i]' : undefined,
      syllables: []
    })),
    otoEntries: [
      {
        fileName: '_ka_ki_ku_0.wav',
        alias: '- ka',
        offsetMs: 120,
        consonantMs: 80,
        cutoffMs: -200,
        preutteranceMs: 60,
        overlapMs: 20
      }
    ],
    detectedEncoding: 'utf-8',
    rawOtoText: '_ka_ki_ku_0.wav=- ka,120,80,-200,60,20',
    readmeMarkdown: '## Phoneme Guide\n\n- `O` like the a in *father*\n- `e` as in bed'
  };
}

/** Fallback bridge seeded with one project + recent entry; methods are plain async fns. */
export function makeBridge(
  options: { manifest?: AieProjectManifest; recent?: RecentProjectSummary[]; bundle?: ParsedRecordingListBundle } = {}
): AieBridgeApi {
  const manifest = options.manifest ?? makeManifest();
  const bridge = createFallbackBridge({
    projects: [manifest],
    recent: options.recent ?? [makeRecent()]
  });
  const bundle = options.bundle ?? makeBundle();
  bridge.voicebank.loadRecordingList = async () => structuredClone(bundle);
  bridge.project.getSetProgress = async (_root, setConfig) => ({
    setId: setConfig.id,
    recordedCount: 2,
    totalCount: bundle.entries.length,
    recordedFileNames: bundle.entries.slice(0, 2).map((entry) => entry.fileName)
  });
  return bridge;
}
