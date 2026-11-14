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
      '--disable-audio-output',
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
      await expect(page.getByText('Vocal Booth')).toBeVisible();
      await expect(page.getByText('Link Start')).toHaveCount(0);

      // Stub Electron's native OS folder picker so clicking "Choose Folder" selects `singerRootDir`.
      await firstLaunch.app.evaluate(({ dialog }, targetDir) => {
        dialog.showOpenDialog = (async () => ({
          canceled: false,
          filePaths: [targetDir]
        })) as typeof dialog.showOpenDialog;
      }, singerRootDir);

      // ---- 1. Screen 1 Hub: Create New Singer Project with Selective Singer Files ----
      await page.getByTestId('hub-create-btn').click();
      const createDialog = page.getByTestId('create-project-dialog');
      await expect(createDialog).toBeVisible();
      await expect(createDialog.getByTestId('create-singer-files')).toBeVisible();

      const createCharTxt = createDialog.getByTestId('create-singer-file-character-txt');
      const createCharYaml = createDialog.getByTestId('create-singer-file-character-yaml');
      const createPrefixMap = createDialog.getByTestId('create-singer-file-prefix-map');
      await expect(createCharTxt).toHaveAttribute('aria-checked', 'true');
      await expect(createCharYaml).toHaveAttribute('aria-checked', 'true');
      await expect(createPrefixMap).toHaveAttribute('aria-checked', 'true');

      // Uncheck `prefix.map` during project creation while keeping `character.txt` & `character.yaml` enabled.
      await createPrefixMap.click();
      await expect(createPrefixMap).toHaveAttribute('aria-checked', 'false');

      await createDialog.getByTestId('create-project-name').fill('Astra');
      await createDialog.getByTestId('create-project-author').fill('Team aie');
      await createDialog.getByTestId('create-project-pick-folder').click();
      await expect(createDialog.getByTestId('create-project-folder')).toHaveValue(singerRootDir);
      await createDialog.getByTestId('create-project-submit').click();

      // Verify transition to Screen 2 and selective singer files on disk (`prefix.map` omitted).
      await expect(page.getByTestId('project-screen')).toBeVisible();
      await expect(page.getByTestId('project-name')).toHaveText('Astra');

      const manifestPath = path.join(singerRootDir, 'aie.project.json');
      const characterTxtPath = path.join(singerRootDir, 'character.txt');
      const characterYamlPath = path.join(singerRootDir, 'character.yaml');
      const prefixMapPath = path.join(singerRootDir, 'prefix.map');

      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(fs.existsSync(characterTxtPath)).toBe(true);
      expect(fs.existsSync(characterYamlPath)).toBe(true);
      expect(fs.existsSync(prefixMapPath)).toBe(false);

      const initialManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        schemaVersion: number;
        name: string;
        author?: string;
        singerFiles?: { characterTxt: boolean; characterYaml: boolean; prefixMap: boolean };
      };
      expect(initialManifest.schemaVersion).toBe(1);
      expect(initialManifest.name).toBe('Astra');
      expect(initialManifest.author).toBe('Team aie');
      expect(initialManifest.singerFiles).toEqual({
        characterTxt: true,
        characterYaml: true,
        prefixMap: false
      });
      expect(fs.readFileSync(characterTxtPath, 'utf8')).toContain('name=Astra');

      // Verify Project header `Open In ▾` menu and re-enable `prefix.map` via `project-singer-files-btn`.
      await page.getByTestId('project-open-in-btn').click();
      const projectOpenInMenu = page.getByTestId('project-open-in-menu');
      await expect(projectOpenInMenu).toBeVisible();
      await expect(projectOpenInMenu.getByTestId('handoff-reveal')).toBeVisible();
      await expect(projectOpenInMenu.getByTestId('handoff-vlabeler')).toBeVisible();
      await expect(projectOpenInMenu.getByTestId('handoff-openutau')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(projectOpenInMenu).toBeHidden();

      await expect(page.getByTestId('project-singer-files-btn')).toContainText('2/3');
      await page.getByTestId('project-singer-files-btn').click();
      const projectSingerFiles = page.getByTestId('project-singer-files');
      await expect(projectSingerFiles).toBeVisible();
      const projectPrefixMap = projectSingerFiles.getByTestId('project-singer-file-prefix-map');
      await expect(projectPrefixMap).toHaveAttribute('aria-checked', 'false');
      await projectPrefixMap.click();
      await expect(projectPrefixMap).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('project-singer-files-btn')).toContainText('3/3');
      await page.keyboard.press('Escape');
      await expect(projectSingerFiles).toBeHidden();

      // ---- 2. Screen 2 Project Sets: Verify Section #1 Reclist & Create A4 Subbank ----
      await page.getByTestId('set-add-btn').click();
      const setEditor = page.getByTestId('set-editor');
      await expect(setEditor).toBeVisible();

      const reclistBuiltinBtn = setEditor.getByTestId('set-reclist-mode-builtin');
      const reclistCustomBtn = setEditor.getByTestId('set-reclist-mode-custom');
      await expect(reclistBuiltinBtn).toBeVisible();
      await expect(reclistCustomBtn).toBeVisible();

      const reclistBox = await reclistBuiltinBtn.boundingBox();
      const setNameBox = await setEditor.getByTestId('set-name-input').boundingBox();
      const setScaleBox = await setEditor.getByTestId('set-scale-select').boundingBox();
      expect(reclistBox).not.toBeNull();
      expect(setNameBox).not.toBeNull();
      expect(setScaleBox).not.toBeNull();
      expect(reclistBox!.y).toBeLessThan(setNameBox!.y);
      expect(reclistBox!.y).toBeLessThan(setScaleBox!.y);

      await setEditor.getByTestId('set-reclist-builtin-z_cvvc_normal').click();
      await setEditor.getByTestId('set-scale-select').selectOption('A4');
      await expect(setEditor.getByTestId('set-alias-input')).toHaveValue('_A4');
      await expect(setEditor.getByTestId('set-subfolder-input')).toHaveValue('A4');
      await setEditor.getByTestId('set-name-input').fill('Normal A4');
      await setEditor.getByTestId('set-save-btn').click();

      await expect(page.getByTestId('set-card')).toBeVisible();
      await expect(page.getByTestId('set-card-scale')).toHaveText('A4');
      await expect(page.getByTestId('set-card-hz')).toHaveText('440 Hz');
      await expect(page.getByTestId('set-card-reclist-btn')).toBeVisible();

      // Verify `_A4` suffixed `oto.ini`, OpenUtau `character.yaml` `subbanks`, and enabled `prefix.map` on disk.
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
      expect(fs.existsSync(prefixMapPath)).toBe(true);
      expect(fs.readFileSync(prefixMapPath, 'utf8')).toContain('_A4');

      // Enter Screen 3: The Recording Studio.
      await page.getByTestId('set-start-btn').click();
      const studioScreen = page.getByTestId('studio-screen');
      await expect(studioScreen).toBeVisible();
      await expect(studioScreen).toHaveAttribute('data-phase', 'idle');

      // ---- 3. Screen 3 Studio: Viewport Fit, Pagination, Header Menus & Inline Target Pitch ----
      const viewportMetrics = await page.evaluate(() => ({
        innerHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight
      }));
      expect(viewportMetrics.scrollHeight).toBeLessThanOrEqual(viewportMetrics.innerHeight);

      const initialTransportBox = await page.getByTestId('studio-transport').boundingBox();
      expect(initialTransportBox).not.toBeNull();
      expect(initialTransportBox!.y + initialTransportBox!.height).toBeLessThanOrEqual(
        viewportMetrics.innerHeight + 0.5
      );

      // Also verify 760px content height (Windows/Linux 1280x820 frame with titlebar + menu bar) fits cleanly.
      await firstLaunch.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.setContentSize(1280, 760);
      });
      await expect
        .poll(async () => page.evaluate(() => window.innerHeight))
        .toBeLessThanOrEqual(760);
      const compactMetrics = await page.evaluate(() => ({
        innerHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight
      }));
      expect(compactMetrics.scrollHeight).toBeLessThanOrEqual(compactMetrics.innerHeight);
      const compactTransportBox = await page.getByTestId('studio-transport').boundingBox();
      expect(compactTransportBox).not.toBeNull();
      expect(compactTransportBox!.y + compactTransportBox!.height).toBeLessThanOrEqual(
        compactMetrics.innerHeight + 0.5
      );
      await firstLaunch.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.setSize(1280, 820);
      });

      // Verify 30-item pagination on `z_cvvc_normal` (> 30 prompts).
      await expect(page.getByTestId('studio-pagination')).toBeVisible();
      await expect(page.getByTestId('studio-page-indicator')).toContainText('Page 1 /');
      await expect(page.getByTestId('studio-item-list').locator('> li')).toHaveCount(30);
      await page.getByTestId('studio-page-next').click();
      await expect(page.getByTestId('studio-page-indicator')).toContainText('Page 2 /');
      await expect(page.getByTestId('studio-item-30')).toBeVisible();
      await page.getByTestId('studio-page-prev').click();
      await expect(page.getByTestId('studio-page-indicator')).toContainText('Page 1 /');

      // Verify header `Booth Options ▾`, `Open In ▾`, and `?` Shortcuts popovers.
      await page.getByTestId('studio-options-btn').click();
      const studioOptionsPopover = page.getByTestId('studio-options-popover');
      await expect(studioOptionsPopover).toBeVisible();
      await expect(studioOptionsPopover.getByTestId('studio-mode-toggle')).toBeVisible();
      await expect(studioOptionsPopover.getByTestId('studio-toggle-listen-back')).toBeVisible();
      await expect(studioOptionsPopover.getByTestId('studio-toggle-oto')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(studioOptionsPopover).toBeHidden();

      await page.getByTestId('studio-open-in-btn').click();
      const studioOpenInMenu = page.getByTestId('studio-open-in-menu');
      await expect(studioOpenInMenu).toBeVisible();
      await expect(studioOpenInMenu.getByTestId('studio-reveal-folder')).toBeVisible();
      await expect(studioOpenInMenu.getByTestId('studio-open-vlabeler')).toBeVisible();
      await expect(studioOpenInMenu.getByTestId('studio-open-openutau')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(studioOpenInMenu).toBeHidden();

      await page.getByTestId('studio-hotkeys-btn').click();
      const studioHotkeysPopover = page.getByTestId('studio-hotkeys-popover');
      await expect(studioHotkeysPopover).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(studioHotkeysPopover).toBeHidden();

      // Switch inline Target Pitch selector to G3 (196 Hz) and back to A4 (440 Hz).
      const targetPitchSelect = page.getByTestId('studio-target-pitch-select');
      const studioScaleBtn = page.getByTestId('studio-scale-btn');
      await expect(studioScaleBtn).toContainText('A4 (440 Hz)');
      await targetPitchSelect.selectOption('G3');
      await expect(studioScaleBtn).toContainText('G3 (196 Hz)');
      await targetPitchSelect.selectOption('A4');
      await expect(studioScaleBtn).toContainText('A4 (440 Hz)');

      // ---- 4. Navigate, Record 440 Hz Take, Focus-Safe Space, Overwrite & Undo Retake ----
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

      // Verify G4 (392 Hz) vs G3 (196 Hz) subharmonic disambiguation on a modulated G4 vowel frame.
      const g4Frame = new Float32Array(2048);
      for (let i = 0; i < g4Frame.length; i++) {
        const tSec = i / 44100;
        g4Frame[i] =
          0.45 * Math.sin(2 * Math.PI * 392 * tSec) +
          0.25 * Math.sin(2 * Math.PI * 784 * tSec) +
          0.14 * Math.sin(2 * Math.PI * 196 * tSec);
      }
      const g4Pitch = estimateVocalPitch(g4Frame, 44100, 'G4');
      expect(g4Pitch.noteLabel).toBe('G4');
      expect(g4Pitch.frequencyHz).not.toBeNull();
      expect(Math.abs((g4Pitch.frequencyHz ?? 0) - 392)).toBeLessThan(6);

      // Focus-safe `Space` on `Reference Tone`: while `studio-scale-btn` is keyboard-focused,
      // `Space` must toggle the reference tone (`aria-pressed`) without hijacking take playback!
      await studioScaleBtn.focus();
      await page.keyboard.press('Space');
      await expect(studioScaleBtn).toHaveAttribute('aria-pressed', 'true');
      await expect(studioScreen).toHaveAttribute('data-phase', 'idle');
      await page.keyboard.press('Space');
      await expect(studioScaleBtn).toHaveAttribute('aria-pressed', 'false');
      await expect(studioScreen).toHaveAttribute('data-phase', 'idle');

      // Pointer-clicking `studio-scale-btn` blurs focus so global `Space` playback works right away.
      await studioScaleBtn.click();
      await expect(studioScaleBtn).toHaveAttribute('aria-pressed', 'true');
      await studioScaleBtn.click();
      await expect(studioScaleBtn).toHaveAttribute('aria-pressed', 'false');

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

      // Verify eye-level feedback/warning strip sits visually ABOVE `studio-canvas` (never below transport)
      // and `studio-transport` remains 100% inside the viewport even with status/warnings visible.
      const feedbackStrip = page.getByTestId('studio-feedback-strip');
      await expect(feedbackStrip).toBeVisible();
      await expect(page.getByTestId('studio-status')).toBeVisible();
      const feedbackBox = await feedbackStrip.boundingBox();
      const canvasBox = await page.getByTestId('studio-canvas').boundingBox();
      const transportAfterUndoBox = await page.getByTestId('studio-transport').boundingBox();
      expect(feedbackBox).not.toBeNull();
      expect(canvasBox).not.toBeNull();
      expect(transportAfterUndoBox).not.toBeNull();
      const afterUndoInnerHeight = await page.evaluate(() => window.innerHeight);
      expect(feedbackBox!.y).toBeLessThan(canvasBox!.y);
      expect(transportAfterUndoBox!.y + transportAfterUndoBox!.height).toBeLessThanOrEqual(
        afterUndoInnerHeight + 0.5
      );

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

      // ---- 6. App Relaunch & 1-Click Resume Session ----
      const secondLaunch = await launchAieApp(userDataDir);
      activeApp = secondLaunch.app;
      const relaunchedPage = secondLaunch.page;

      await expect(relaunchedPage.getByText('Vocal Booth')).toBeVisible();
      await expect(relaunchedPage.getByText('Link Start')).toHaveCount(0);
      await expect(relaunchedPage.getByTestId('hub-continue-card')).toBeVisible();
      await expect(relaunchedPage.getByTestId('hub-continue-btn')).toHaveText('Resume Session');
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
      try {
        fs.rmSync(tmpBase, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // Ignore transient OS temp file locks after Electron child-process teardown.
      }
    }
  });
});
