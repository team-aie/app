import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { parse as parseYaml } from 'yaml';
import { estimateVocalPitch } from '../../src/renderer/src/audio/dsp-analysis';
import { decodeWavBytes } from '../../src/renderer/src/audio/wav-codec';

const MAIN_ENTRY = path.resolve('out/main/index.js');
const FAKE_MIC_WAV = path.resolve('tests/fixtures/audio/vocal-a4-440hz.wav');

async function launchAieApp(userDataDir: string): Promise<{
  app: ElectronApplication;
  page: Page;
  pageErrors: string[];
  cspViolations: string[];
}> {
  const app = await electron.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${FAKE_MIC_WAV}`,
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--no-sandbox',
      MAIN_ENTRY
    ],
    env: {
      ...process.env,
      AIE_USER_DATA_DIR: userDataDir
    }
  });

  const page = await app.firstWindow();
  const pageErrors: string[] = [];
  const cspViolations: string[] = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __cspViolations?: string[] }).__cspViolations ??= [];
      (window as unknown as { __cspViolations?: string[] }).__cspViolations!.push(
        `${event.violatedDirective}: ${event.blockedURI}`
      );
    });
  });

  await page.waitForLoadState('domcontentloaded');
  return { app, page, pageErrors, cspViolations };
}

test.describe('aie v1 Full-Stack Electron Fake-Mic E2E', () => {
  test('creates a turnkey singer, scaffolds A4 subbank, records 440 Hz take via AudioWorklet, plays back, undoes retake, switches 3 locales, and resumes session on relaunch', async () => {
    expect(fs.existsSync(MAIN_ENTRY)).toBe(true);
    expect(fs.existsSync(FAKE_MIC_WAV)).toBe(true);

    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'aie-v1-e2e-'));
    const userDataDir = path.join(tmpBase, 'user-data');
    const singerRootDir = path.join(tmpBase, 'Astra_VB');
    fs.mkdirSync(userDataDir, { recursive: true });

    let activeApp: ElectronApplication | null = null;

    try {
      const firstLaunch = await launchAieApp(userDataDir);
      activeApp = firstLaunch.app;
      const { page, pageErrors } = firstLaunch;

      // Track runtime CSP violations inside the already-loaded page as well.
      await page.evaluate(() => {
        (window as unknown as { __cspViolations?: string[] }).__cspViolations = [];
        window.addEventListener('securitypolicyviolation', (event) => {
          (window as unknown as { __cspViolations?: string[] }).__cspViolations!.push(
            `${event.violatedDirective}: ${event.blockedURI}`
          );
        });
      });

      // Ensure consistent starting locale (`en-US`) regardless of host OS language.
      await expect(page.getByTestId('hub-screen')).toBeVisible();
      await page.getByTestId('header-lang-en-US').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
      await expect(page.getByText('Link Start')).toBeVisible();

      // Stub Electron's native OS folder picker so clicking "Choose Folder" selects `singerRootDir`.
      await firstLaunch.app.evaluate(({ dialog }, targetDir) => {
        dialog.showOpenDialog = (async () => ({
          canceled: false,
          filePaths: [targetDir]
        })) as typeof dialog.showOpenDialog;
      }, singerRootDir);

      // ---- 1. Screen 1 Hub: Create New Singer Project ----
      await page.getByTestId('hub-create-btn').click();
      const createDialog = page.getByTestId('create-project-dialog');
      await expect(createDialog).toBeVisible();

      await createDialog.getByTestId('create-project-name').fill('Astra');
      await createDialog.getByTestId('create-project-author').fill('Team aie');
      await createDialog.getByTestId('create-project-pick-folder').click();
      await expect(createDialog.getByTestId('create-project-folder')).toHaveValue(singerRootDir);
      await createDialog.getByTestId('create-project-submit').click();

      // Verify transition to Screen 2 and turnkey singer files on disk.
      await expect(page.getByTestId('project-screen')).toBeVisible();
      await expect(page.getByTestId('project-name')).toHaveText('Astra');

      const manifestPath = path.join(singerRootDir, 'aie.project.json');
      const characterTxtPath = path.join(singerRootDir, 'character.txt');
      const characterYamlPath = path.join(singerRootDir, 'character.yaml');

      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(fs.existsSync(characterTxtPath)).toBe(true);
      expect(fs.existsSync(characterYamlPath)).toBe(true);

      const initialManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        schemaVersion: number;
        name: string;
        author?: string;
      };
      expect(initialManifest.schemaVersion).toBe(1);
      expect(initialManifest.name).toBe('Astra');
      expect(initialManifest.author).toBe('Team aie');
      expect(fs.readFileSync(characterTxtPath, 'utf8')).toContain('name=Astra');

      // ---- 2. Screen 2 Project Sets: Create A4 Subbank with Built-in Reclist ----
      await page.getByTestId('set-add-btn').click();
      const setEditor = page.getByTestId('set-editor');
      await expect(setEditor).toBeVisible();

      await setEditor.getByTestId('set-scale-select').selectOption('A4');
      await expect(setEditor.getByTestId('set-alias-input')).toHaveValue('_A4');
      await expect(setEditor.getByTestId('set-subfolder-input')).toHaveValue('A4');

      await setEditor.getByTestId('set-reclist-builtin-z_cvvc_normal').click();
      await setEditor.getByTestId('set-name-input').fill('Normal A4');
      await setEditor.getByTestId('set-save-btn').click();

      await expect(page.getByTestId('set-card')).toBeVisible();
      await expect(page.getByTestId('set-card-scale')).toHaveText('A4');

      // Verify `_A4` suffixed `oto.ini` and OpenUtau `character.yaml` `subbanks` on disk.
      const subbankOtoPath = path.join(singerRootDir, 'A4', 'oto.ini');
      expect(fs.existsSync(subbankOtoPath)).toBe(true);
      const otoContent = fs.readFileSync(subbankOtoPath, 'utf8');
      expect(otoContent).toContain('_A4,');
      expect(otoContent).not.toContain('_A4_A4,');

      const parsedCharYaml = parseYaml(fs.readFileSync(characterYamlPath, 'utf8')) as {
        text_file_encoding?: string;
        singer_type?: string;
        subbanks?: Array<{ color?: string; prefix?: string; suffix?: string; tone_ranges?: string[] }>;
      };
      expect(parsedCharYaml.text_file_encoding).toBe('utf-8');
      expect(parsedCharYaml.singer_type).toBe('utau');
      expect(parsedCharYaml.subbanks?.some((sb) => sb.suffix === '_A4')).toBe(true);
      expect(fs.readFileSync(path.join(singerRootDir, 'prefix.map'), 'utf8')).toContain('_A4');

      // Enter Screen 3: The Recording Studio.
      await page.getByTestId('set-start-btn').click();
      const studioScreen = page.getByTestId('studio-screen');
      await expect(studioScreen).toBeVisible();
      await expect(studioScreen).toHaveAttribute('data-phase', 'idle');

      // ---- 3. Screen 3 Studio: Navigate, Record 440 Hz Take, Play Back, Overwrite & Undo Retake ----
      // Ensure keyboard focus is on the Studio document body (not a button) and advance to prompt index 1.
      await page.getByTestId('studio-prompt-current').click();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('studio-prompt-position')).toContainText('2 /');

      const promptAtIndex1 = (await page.getByTestId('studio-prompt-current').textContent())?.trim() ?? '';
      const targetWavName = (await page.getByTestId('studio-prompt-filename').textContent())?.trim() ?? '';
      expect(promptAtIndex1.length).toBeGreaterThan(0);
      expect(targetWavName.endsWith('.wav')).toBe(true);

      const targetWavPath = path.join(singerRootDir, 'A4', targetWavName);
      expect(fs.existsSync(targetWavPath)).toBe(false);

      // Hold `R` (PTT mode) until live 440 Hz AudioWorklet telemetry arrives, then capture ~450 ms.
      await page.keyboard.down('KeyR');
      await expect(studioScreen).toHaveAttribute('data-phase', 'recording');
      await expect(page.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'live');
      await expect
        .poll(
          async () => {
            const statusVisible = await page.getByTestId('studio-status').isVisible();
            const statusText = statusVisible ? await page.getByTestId('studio-status').textContent() : '';
            const readout = await page.getByTestId('studio-pitch-readout').textContent();
            const phaseNow = await studioScreen.getAttribute('data-phase');
            if (statusText) return `STATUS:${statusText}`;
            if (phaseNow !== 'recording') return `PHASE:${phaseNow}`;
            return readout && readout.includes('A4') ? 'LIVE_A4' : `READOUT:${readout ?? ''}`;
          },
          { timeout: 8_000 }
        )
        .toBe('LIVE_A4');
      await page.waitForTimeout(450);
      await page.keyboard.up('KeyR');

      // Wait for save + Auto-Listen-Back to finish and return to `idle` review mode.
      await expect
        .poll(() => fs.existsSync(targetWavPath), { timeout: 10_000 })
        .toBe(true);
      await expect(studioScreen).toHaveAttribute('data-phase', 'idle', { timeout: 10_000 });
      await expect(page.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'review');
      await expect(page.getByTestId('studio-progress')).toContainText('1 /');

      // Decode Take 1 from disk and verify non-silent PCM samples + 440 Hz (`A4`) pitch preservation!
      const take1Bytes = new Uint8Array(fs.readFileSync(targetWavPath));
      const take1Decoded = decodeWavBytes(take1Bytes);
      expect(take1Decoded.sampleRate).toBe(44100);
      expect(take1Decoded.samples.length).toBeGreaterThan(8_000);

      let take1Peak = 0;
      for (let i = 0; i < take1Decoded.samples.length; i++) {
        const abs = Math.abs(take1Decoded.samples[i]!);
        if (abs > take1Peak) take1Peak = abs;
      }
      expect(take1Peak).toBeGreaterThan(0.15);

      const midStart = Math.max(0, Math.floor(take1Decoded.samples.length / 2) - 1024);
      const midWindow = take1Decoded.samples.subarray(midStart, midStart + 2048);
      const detectedPitch = estimateVocalPitch(midWindow, take1Decoded.sampleRate, 'A4');
      expect(detectedPitch).not.toBeNull();
      if (!detectedPitch || detectedPitch.frequencyHz === null) {
        throw new Error('Expected detected A4 pitch');
      }
      expect(detectedPitch.noteLabel).toBe('A4');
      expect(Math.abs(detectedPitch.frequencyHz - 440)).toBeLessThan(8);

      // Test manual playback via `Space` (start -> playing -> stop -> idle).
      await page.keyboard.press('Space');
      await expect(studioScreen).toHaveAttribute('data-phase', 'playing');
      await page.keyboard.press('Space');
      await expect(studioScreen).toHaveAttribute('data-phase', 'idle');

      // Overwrite with a longer Take 2 (~950 ms) and test 1-Step Undo Retake.
      const take1SampleCount = take1Decoded.samples.length;
      await page.keyboard.down('KeyR');
      await expect(studioScreen).toHaveAttribute('data-phase', 'recording');
      await expect
        .poll(async () => (await page.getByTestId('studio-pitch-readout').textContent()) ?? '', {
          timeout: 8_000
        })
        .toContain('A4');
      await page.waitForTimeout(950);
      await page.keyboard.up('KeyR');

      await expect(studioScreen).toHaveAttribute('data-phase', 'idle', { timeout: 10_000 });
      const take2Decoded = decodeWavBytes(new Uint8Array(fs.readFileSync(targetWavPath)));
      expect(take2Decoded.samples.length).toBeGreaterThan(take1SampleCount + 10_000);

      const undoBtn = page.getByTestId('studio-undo-btn');
      await expect(undoBtn).toBeEnabled();
      await undoBtn.click();

      await expect
        .poll(() => decodeWavBytes(new Uint8Array(fs.readFileSync(targetWavPath))).samples.length, {
          timeout: 5_000
        })
        .toBe(take1SampleCount);

      // ---- 4. Live 3-Locale Switching (`EN` / `简` / `日`) ----
      await page.getByTestId('header-lang-zh-CN').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
      await expect(page.getByTestId('studio-record-btn')).toContainText('录制');

      await page.getByTestId('header-lang-ja-JP').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja-JP');
      await expect(page.getByTestId('studio-record-btn')).toContainText('録音');

      await page.getByTestId('header-lang-en-US').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
      await expect(page.getByTestId('studio-record-btn')).toContainText('Record');

      // Verify zero CSP violations occurred (confirming `Blob` URL `AudioWorkletProcessor` loaded natively)
      // and ensure `lastCursorIndex === 1` has flushed to `aie.project.json` before relaunching.
      const runtimeCspViolations = await page.evaluate(
        () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? []
      );
      expect(runtimeCspViolations).toEqual([]);
      expect(pageErrors).toEqual([]);

      await expect
        .poll(() => {
          const saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
            sets: Array<{ lastCursorIndex: number }>;
          };
          return saved.sets[0]?.lastCursorIndex;
        })
        .toBe(1);

      await firstLaunch.app.close();
      activeApp = null;

      // ---- 5. App Relaunch & 1-Click Continue Last Session ----
      const secondLaunch = await launchAieApp(userDataDir);
      activeApp = secondLaunch.app;
      const relaunchedPage = secondLaunch.page;

      await expect(relaunchedPage.getByTestId('hub-continue-card')).toBeVisible();
      await expect(relaunchedPage.getByTestId('hub-continue-name')).toHaveText('Astra');
      await expect(relaunchedPage.getByTestId('hub-continue-scale')).toHaveText('A4');
      await expect(relaunchedPage.getByTestId('hub-continue-progress')).toContainText('1 /');

      await relaunchedPage.getByTestId('hub-continue-btn').click();
      await expect(relaunchedPage.getByTestId('studio-screen')).toBeVisible();
      await expect(relaunchedPage.getByTestId('studio-prompt-position')).toContainText('2 /');
      await expect(relaunchedPage.getByTestId('studio-prompt-current')).toHaveText(promptAtIndex1);
      await expect(relaunchedPage.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'review');
      expect(secondLaunch.pageErrors).toEqual([]);

      await secondLaunch.app.close();
      activeApp = null;
    } finally {
      if (activeApp) {
        await activeApp.close().catch(() => undefined);
      }
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
