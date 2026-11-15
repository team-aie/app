import '@testing-library/jest-dom/vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AboutModal,
  AudioSettingsModal,
  createClickUnlocker,
  dbToMeter,
  DEVTOOLS_CLICK_WINDOW_MS,
  peakToDb
} from '@renderer/components/modals';
import { StudioHost } from '@renderer/components/shell/studio-host';
import type { StudioScreenProps } from '@renderer/components/shell/studio-screen-slot';
import { Toaster } from '@renderer/components/shell/toaster';
import {
  createAppStore,
  CURSOR_SAVE_DEBOUNCE_MS,
  resetAppStore,
  selectActiveSet,
  useAppStore
} from '@renderer/store/use-app-store';
import { installDomShims, makeBridge, makeManifest, makeSet, renderWithI18n } from './test-utils';

installDomShims();

describe('Global Modals (About/Diagnostics/Licenses + Audio Settings) & App Store', () => {
  it('unlocks DevTools on 5 rapid clicks of the Version badge with a non-blocking toast', async () => {
    // Unit-verify click window reset behavior first
    let clock = 1_000;
    const rawUnlock = vi.fn();
    const click = createClickUnlocker(rawUnlock, 5, DEVTOOLS_CLICK_WINDOW_MS, () => clock);
    expect(click()).toBe(1);
    expect(click()).toBe(2);
    clock += DEVTOOLS_CLICK_WINDOW_MS + 50; // Stale window resets counter to 1
    expect(click()).toBe(1);
    expect(rawUnlock).not.toHaveBeenCalled();

    // Full component flow
    const user = userEvent.setup();
    const bridge = makeBridge();
    const devToolsSpy = vi.spyOn(bridge.app, 'toggleDevTools');
    bridge.app.getVersion = async () => '1.0.0-alpha.0';

    resetAppStore(bridge);
    await useAppStore.getState().init();
    useAppStore.getState().openModal('about');

    renderWithI18n(
      <>
        <AboutModal />
        <Toaster />
      </>
    );

    const badge = await screen.findByTestId('about-version-badge');
    expect(badge).toHaveTextContent('Version 1.0.0-alpha.0');

    for (let i = 0; i < 4; i += 1) {
      await user.click(badge);
    }
    expect(devToolsSpy).not.toHaveBeenCalled();

    await user.click(badge);
    expect(devToolsSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Developer Tools unlocked')).toBeInTheDocument();
  });

  it('exports Diagnostic Zip, lists Built-in Reclists credits, searches OSS Licenses, and opens Chromium notices', async () => {
    const user = userEvent.setup();
    const bridge = makeBridge();
    bridge.app.exportDiagnosticZip = vi.fn(async () => ({
      canceled: false,
      zipPath: '/Users/demo/Desktop/aie-diagnostics.zip'
    }));
    bridge.app.getOssLicenses = vi.fn(async () => [
      {
        name: 'pitchy',
        version: '4.1.0',
        license: 'MIT',
        author: 'ianprime0509',
        repository: 'https://github.com/ianprime0509/pitchy',
        licenseText: 'MIT License\nPermission is hereby granted...'
      },
      {
        name: 'fflate',
        version: '0.8.2',
        license: 'MIT',
        author: '101arrowz',
        repository: 'https://github.com/101arrowz/fflate',
        licenseText: 'MIT License\nFast compression...'
      }
    ]);
    const chromiumSpy = vi.spyOn(bridge.app, 'openChromiumNotices');
    const urlSpy = vi.spyOn(bridge.shell, 'openExternalUrl');

    resetAppStore(bridge);
    await useAppStore.getState().init();
    useAppStore.getState().openModal('about');

    renderWithI18n(
      <>
        <AboutModal />
        <Toaster />
      </>
    );

    const modal = await screen.findByTestId('about-modal');
    expect(within(modal).getByTestId('about-app-icon')).toHaveAttribute('src');

    // Tab 1: Built-in Reclists
    expect(within(modal).getAllByTestId('about-reclist')).toHaveLength(4);
    expect(within(modal).getByText('Delta English Ver.5 (CVVC)')).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: 'Homepage' }));
    expect(urlSpy).toHaveBeenCalledWith('https://ch.nicovideo.jp/delta_kimigatame/blomaga/ar581614');

    // 1-Click Export Diagnostic Zip
    await user.click(within(modal).getByTestId('about-export-diagnostics'));
    expect(await screen.findByText(/aie-diagnostics\.zip/)).toBeInTheDocument();

    // Tab 2: Open-Source Libraries search + expand + Chromium notices
    await user.click(within(modal).getByTestId('about-tab-oss'));
    await waitFor(() => expect(within(modal).getAllByTestId('oss-row')).toHaveLength(2));

    await user.type(within(modal).getByTestId('oss-search'), 'pitchy');
    const rows = within(modal).getAllByTestId('oss-row');
    expect(rows).toHaveLength(1);

    const toggleBtn = within(rows[0]!).getByRole('button', { expanded: false });
    await user.click(toggleBtn);
    expect(within(rows[0]!).getByText(/Permission is hereby granted/)).toBeInTheDocument();

    await user.click(within(modal).getByTestId('about-chromium-notices'));
    expect(chromiumSpy).toHaveBeenCalledTimes(1);
  });

  it('configures Audio I/O devices, WAV sample rate/bit depth/DC-offset, and external tool paths', async () => {
    expect(peakToDb(0)).toBe(-Infinity);
    expect(peakToDb(1)).toBeCloseTo(0, 5);
    expect(dbToMeter(-Infinity)).toBe(0);
    expect(dbToMeter(-60)).toBe(0);
    expect(dbToMeter(-30)).toBeCloseTo(0.5, 5);
    expect(dbToMeter(0)).toBe(1);

    const originalMedia = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn(async () => [
          { deviceId: 'mic-scarlett', kind: 'audioinput', label: 'Focusrite Scarlett 2i2', groupId: 'g1', toJSON: () => ({}) },
          { deviceId: 'spk-headphones', kind: 'audiooutput', label: 'Studio Headphones', groupId: 'g2', toJSON: () => ({}) }
        ]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    });

    try {
      const user = userEvent.setup();
      const bridge = makeBridge();
      const updateSpy = vi.spyOn(bridge.app, 'updateSettings');

      resetAppStore(bridge);
      await useAppStore.getState().init();
      useAppStore.getState().openModal('audioSettings');

      renderWithI18n(<AudioSettingsModal />);
      const modal = await screen.findByTestId('audio-settings-modal');

      const inputSelect = within(modal).getByTestId('settings-input-device') as HTMLSelectElement;
      await waitFor(() =>
        expect(Array.from(inputSelect.options, (o) => o.textContent)).toContain(
          'Focusrite Scarlett 2i2'
        )
      );

      await user.selectOptions(inputSelect, 'mic-scarlett');
      await user.selectOptions(within(modal).getByTestId('settings-output-device'), 'spk-headphones');
      await user.click(within(modal).getByTestId('settings-rate-48000'));
      await user.click(within(modal).getByTestId('settings-depth-24'));
      await user.click(within(modal).getByTestId('settings-dc-offset'));
      await user.type(within(modal).getByTestId('settings-vLabelerPath'), '/Applications/vLabeler.app');

      await waitFor(() => {
        const current = useAppStore.getState().settings;
        expect(current.inputDeviceId).toBe('mic-scarlett');
        expect(current.outputDeviceId).toBe('spk-headphones');
        expect(current.wavFormat).toEqual({
          sampleRate: 48000,
          bitDepth: 24,
          removeDcOffset: false
        });
        expect(current.externalTools.vLabelerPath).toBe('/Applications/vLabeler.app');
      });
      expect(updateSpy).toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: originalMedia
      });
    }
  });

  it('falls back cleanly when window.aie is absent and debounces/flushes studio cursor persistence', async () => {
    const win = window as Partial<Window>;
    const savedAie = win.aie;
    delete win.aie;
    try {
      const fallbackStore = createAppStore();
      expect(fallbackStore.getState().bridgeAvailable).toBe(false);
      await fallbackStore.getState().init();
      expect(fallbackStore.getState().initialized).toBe(true);
      expect(fallbackStore.getState().builtinReclists).toHaveLength(4);
      const created = await fallbackStore.getState().createProject({
        name: 'Preview Singer',
        rootPath: '/preview/singer'
      });
      expect(created?.name).toBe('Preview Singer');
    } finally {
      if (savedAie) {
        win.aie = savedAie;
      }
    }

    vi.useFakeTimers();
    try {
      const manifest = makeManifest();
      const bridge = makeBridge({ manifest });
      const saveSpy = vi.spyOn(bridge.project, 'saveProject');
      const store = createAppStore(bridge);

      await store.getState().openProject(manifest.rootPath);
      store.getState().updateCursor(4);
      store.getState().updateCursor(5);

      expect(saveSpy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(CURSOR_SAVE_DEBOUNCE_MS);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy.mock.calls[0]?.[0]?.sets[0]?.lastCursorIndex).toBe(5);

      // Immediate flush on navigation
      store.getState().updateCursor(2);
      await store.getState().flushPendingSave();
      expect(saveSpy).toHaveBeenCalledTimes(2);
      expect(saveSpy.mock.calls[1]?.[0]?.sets[0]?.lastCursorIndex).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('quick-switches active set scale in Studio while keeping folder, aliasSuffix, cursor, and live bundle intact', async () => {
    const user = userEvent.setup();
    const manifest = makeManifest({
      rootPath: '/voicebanks/teto',
      sets: [
        makeSet({
          id: 'set-g4',
          name: 'Normal G4',
          subfolderName: 'G4',
          scale: 'G4',
          aliasSuffix: '_G4',
          lastCursorIndex: 3
        })
      ],
      activeSetId: 'set-g4'
    });
    const bridge = makeBridge({ manifest });
    const upsertSpy = vi.spyOn(bridge.project, 'upsertRecordingSet');
    const loadListSpy = vi.spyOn(bridge.voicebank, 'loadRecordingList');
    const revealSpy = vi.spyOn(bridge.shell, 'revealInFileManager');

    resetAppStore(bridge);
    await useAppStore.getState().init();
    await useAppStore.getState().openProject(manifest.rootPath);
    await useAppStore.getState().enterStudio('set-g4');
    useAppStore.getState().updateCursor(4);

    const beforeStudio = useAppStore.getState().studio;
    expect(beforeStudio.status).toBe('ready');
    expect(loadListSpy).toHaveBeenCalledTimes(1);

    function StudioSeamProbe(props: StudioScreenProps) {
      return (
        <div data-testid="studio-probe">
          <span data-testid="probe-scale">{props.activeSet.scale}</span>
          <span data-testid="probe-cursor">{props.activeSet.lastCursorIndex}</span>
          <span data-testid="probe-folder">{props.activeSet.subfolderName}</span>
          <span data-testid="probe-suffix">{props.activeSet.aliasSuffix}</span>
          <button
            type="button"
            data-testid="probe-switch-g3"
            onClick={() => props.onChangeScale?.('G3')}
          >
            Switch G3
          </button>
          <button
            type="button"
            data-testid="probe-reveal"
            onClick={() => props.onRevealProjectFolder?.()}
          >
            Reveal
          </button>
        </div>
      );
    }

    renderWithI18n(<StudioHost Screen={StudioSeamProbe} />);

    expect(screen.getByTestId('probe-scale')).toHaveTextContent('G4');
    expect(screen.getByTestId('probe-cursor')).toHaveTextContent('4');

    await user.click(screen.getByTestId('probe-switch-g3'));

    await waitFor(() => expect(upsertSpy).toHaveBeenCalledTimes(1));
    expect(upsertSpy).toHaveBeenCalledWith(
      '/voicebanks/teto',
      expect.objectContaining({
        id: 'set-g4',
        scale: 'G3',
        subfolderName: 'G4',
        aliasSuffix: '_G4',
        lastCursorIndex: 4
      })
    );

    expect(screen.getByTestId('probe-scale')).toHaveTextContent('G3');
    expect(screen.getByTestId('probe-folder')).toHaveTextContent('G4');
    expect(screen.getByTestId('probe-suffix')).toHaveTextContent('_G4');
    expect(screen.getByTestId('probe-cursor')).toHaveTextContent('4');
    expect(selectActiveSet(useAppStore.getState())?.scale).toBe('G3');

    // Studio bundle & recordedFileNames stay live without reloading
    const afterStudio = useAppStore.getState().studio;
    expect(afterStudio.status).toBe('ready');
    if (beforeStudio.status === 'ready' && afterStudio.status === 'ready') {
      expect(afterStudio.bundle).toBe(beforeStudio.bundle);
      expect(afterStudio.recordedFileNames).toEqual(beforeStudio.recordedFileNames);
    }
    expect(loadListSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('probe-reveal'));
    expect(revealSpy).toHaveBeenCalledWith('/voicebanks/teto');
  });
});
