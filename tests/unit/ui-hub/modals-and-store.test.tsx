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
import { Toaster } from '@renderer/components/shell/Toaster';
import {
  createAppStore,
  CURSOR_SAVE_DEBOUNCE_MS,
  resetAppStore,
  useAppStore
} from '@renderer/store/useAppStore';
import { installDomShims, makeBridge, makeManifest, renderWithI18n } from './testUtils';

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
});
