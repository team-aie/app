import '@testing-library/jest-dom/vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ALL_SCALE_NOTES } from '@shared/music/chromatic';
import {
  buildCharacterYamlPreview,
  computeToneRanges,
  defaultDraft,
  ProjectScreen,
  sanitizeFolderName,
  validateDraft
} from '@renderer/components/project';
import { AudioSettingsModal } from '@renderer/components/modals';
import { PREVIEW_BUILTIN_RECLISTS } from '@renderer/store/fallback-bridge';
import { resetAppStore, useAppStore } from '@renderer/store/use-app-store';
import {
  installDomShims,
  makeBridge,
  makeManifest,
  makeSet,
  renderWithI18n
} from './test-utils';

installDomShims();

describe('Screen 2 — Project Workspace, Recording Sets, Drawer & Safe Removal', () => {
  it('sanitizes folder names cross-platform, detects collisions, and builds UTF-8 character.yaml previews', () => {
    expect(sanitizeFolderName('  F#4 / Whisper:*?"<>|  ')).toBe('F#4_Whisper');
    expect(sanitizeFolderName('..')).toBe('');
    expect(sanitizeFolderName('CON')).toBe('CON_');
    expect(sanitizeFolderName('連続音 強')).toBe('連続音_強');

    const existing = [
      makeSet({ id: 's1', targetLocation: 'subfolder', subfolderName: 'G4' }),
      makeSet({ id: 's2', targetLocation: 'root', subfolderName: '' })
    ];

    const collidingSub = {
      ...defaultDraft(PREVIEW_BUILTIN_RECLISTS, 'G4'),
      name: 'Duplicate G4',
      subfolderName: 'g4'
    };
    expect(validateDraft(collidingSub, existing).subfolder).toBe('subfolderCollision');

    const collidingRoot = {
      ...defaultDraft(PREVIEW_BUILTIN_RECLISTS, 'C4'),
      name: 'Second Root',
      targetLocation: 'root' as const
    };
    expect(validateDraft(collidingRoot, existing).subfolder).toBe('rootCollision');

    expect(computeToneRanges([60, 67])).toEqual(['C1-D#4', 'E4-B7']);

    const yaml = buildCharacterYamlPreview(
      makeManifest({
        name: 'Kasane Teto',
        author: 'Twindrill',
        sets: [
          makeSet({ id: 'low', scale: 'C4', aliasSuffix: '_C4' }),
          makeSet({ id: 'high', scale: 'G4', aliasSuffix: '_G4' })
        ]
      }),
      PREVIEW_BUILTIN_RECLISTS
    );
    expect(yaml).toContain('text_file_encoding: utf-8');
    expect(yaml).toContain('singer_type: utau');
    expect(yaml).toContain('suffix: _C4');
    expect(yaml).toContain('suffix: _G4');
  });

  it('creates a new set with chromatic scale C2–B5, Audition Pitch, folder sanitization, metronome guide, and turnkey sync', async () => {
    const user = userEvent.setup();
    const manifest = makeManifest({ sets: [makeSet({ id: 'set-g4', subfolderName: 'G4' })] });
    const bridge = makeBridge({ manifest });
    const upsertSpy = vi.spyOn(bridge.project, 'upsertRecordingSet');
    const syncSpy = vi.spyOn(bridge.voicebank, 'syncSingerScaffolding');

    let resolveTone = (): void => undefined;
    const stopSpy = vi.fn(() => resolveTone());
    const playTone = vi.fn(() => ({
      stop: stopSpy,
      finished: new Promise<void>((resolve) => {
        resolveTone = resolve;
      })
    }));

    resetAppStore(bridge);
    await useAppStore.getState().init();
    await useAppStore.getState().openProject(manifest.rootPath);

    renderWithI18n(<ProjectScreen playTone={playTone} />);

    expect(await screen.findByTestId('set-card')).toBeInTheDocument();
    await user.click(screen.getByTestId('set-add-btn'));

    const editor = await screen.findByTestId('set-editor');
    const scaleSelect = within(editor).getByTestId('set-scale-select') as HTMLSelectElement;
    const optionValues = Array.from(scaleSelect.querySelectorAll('option'), (opt) => opt.value);
    expect(optionValues).toEqual([...ALL_SCALE_NOTES]);
    expect(optionValues).toContain('C#3');
    expect(optionValues).toContain('F#4');

    // Default subfolder 'G4' collides with existing set -> visible collision alert
    expect(within(editor).getByRole('alert')).toHaveTextContent('G4');

    // Pick sharp scale F#4 -> auto-updates alias suffix to _F#4 and subfolder to F#4
    await user.selectOptions(scaleSelect, 'F#4');
    expect(within(editor).getByTestId('set-alias-input')).toHaveValue('_F#4');
    expect(within(editor).getByTestId('set-subfolder-input')).toHaveValue('F#4');

    // Audition Pitch plays & stops cleanly
    const auditionBtn = within(editor).getByTestId('set-audition-btn');
    await user.click(auditionBtn);
    expect(playTone).toHaveBeenCalledWith('F#4');
    expect(auditionBtn).toHaveAttribute('aria-pressed', 'true');
    await user.click(auditionBtn);
    expect(stopSpy).toHaveBeenCalled();

    // Dirty folder name shows live sanitized preview
    const subfolderInput = within(editor).getByTestId('set-subfolder-input');
    await user.clear(subfolderInput);
    await user.type(subfolderInput, 'Power / F#4*');
    expect(within(editor).getByTestId('set-path-preview')).toHaveTextContent(
      '/voicebanks/teto/Power_F#4'
    );

    // Select 8-mora built-in reclist -> auto-populates recommended 120 BPM
    await user.click(within(editor).getByTestId('set-reclist-builtin-extended_cvvc_8lite'));

    // Switch to Built-in Pitched Metronome guide
    await user.click(within(editor).getByTestId('set-guide-metronome'));
    expect(within(editor).getByTestId('set-guide-bpm')).toHaveValue(120);

    // Also verify Custom .txt mode exposes all 6 encodings before switching back
    await user.click(within(editor).getByTestId('set-reclist-kind-custom'));
    const encodingSelect = within(editor).getByTestId('set-encoding-select') as HTMLSelectElement;
    expect(Array.from(encodingSelect.options, (o) => o.value)).toEqual([
      'auto',
      'utf-8',
      'utf-16le',
      'utf-16be',
      'shift_jis',
      'gb18030'
    ]);
    await user.click(within(editor).getByTestId('set-reclist-kind-builtin'));

    await user.type(within(editor).getByTestId('set-name-input'), 'Power F#4');
    await user.click(within(editor).getByTestId('set-save-btn'));

    await waitFor(() => expect(upsertSpy).toHaveBeenCalledTimes(1));
    const savedSet = upsertSpy.mock.calls[0]?.[1];
    expect(savedSet).toMatchObject({
      name: 'Power F#4',
      targetLocation: 'subfolder',
      subfolderName: 'Power_F#4',
      scale: 'F#4',
      aliasSuffix: '_F#4',
      reclistSource: { kind: 'builtin', builtinId: 'extended_cvvc_8lite' },
      guideAudio: { kind: 'pitched-metronome', bpm: 120, leadInBeats: 4, moraCount: 8 },
      generateCompanionFiles: true
    });
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('shows Ecosystem Handoff setup prompt when external tool is missing and opens Settings modal', async () => {
    const user = userEvent.setup();
    const manifest = makeManifest();
    const bridge = makeBridge({ manifest });
    bridge.shell.openInExternalTool = vi.fn(async () => ({ ok: false, error: 'not found' }));
    const revealSpy = vi.spyOn(bridge.shell, 'revealInFileManager');

    resetAppStore(bridge);
    await useAppStore.getState().init();
    await useAppStore.getState().openProject(manifest.rootPath);

    renderWithI18n(
      <>
        <ProjectScreen />
        <AudioSettingsModal />
      </>
    );

    await user.click(await screen.findByTestId('handoff-reveal'));
    expect(revealSpy).toHaveBeenCalledWith('/voicebanks/teto');

    await user.click(screen.getByTestId('handoff-vlabeler'));
    const banner = await screen.findByTestId('handoff-tool-missing');
    expect(banner).toHaveTextContent('vLabeler');

    await user.click(within(banner).getByTestId('handoff-open-settings'));
    expect(await screen.findByTestId('audio-settings-modal')).toBeInTheDocument();
  });

  it('renders Slide-Over Metadata Drawer tabs (Reclist search, oto.ini, character.yaml, Creator README)', async () => {
    const user = userEvent.setup();
    const manifest = makeManifest();
    const bridge = makeBridge({ manifest });

    resetAppStore(bridge);
    await useAppStore.getState().init();
    await useAppStore.getState().openProject(manifest.rootPath);

    renderWithI18n(<ProjectScreen />);
    await user.click(await screen.findByTestId('set-preview-btn'));

    const drawer = await screen.findByTestId('metadata-drawer');
    await waitFor(() =>
      expect(within(drawer).getAllByTestId('drawer-reclist-row')).toHaveLength(6)
    );
    expect(within(drawer).getByText('[k a] [k i]')).toBeInTheDocument();

    await user.type(within(drawer).getByTestId('drawer-reclist-search'), '_ka_ki_ku_4');
    expect(within(drawer).getAllByTestId('drawer-reclist-row')).toHaveLength(1);

    await user.click(within(drawer).getByTestId('drawer-tab-oto'));
    expect(within(drawer).getByText('- ka')).toBeInTheDocument();

    await user.click(within(drawer).getByTestId('drawer-tab-character'));
    expect(within(drawer).getByTestId('drawer-character-yaml')).toHaveTextContent(
      'text_file_encoding: utf-8'
    );

    await user.click(within(drawer).getByTestId('drawer-tab-readme'));
    expect(within(drawer).getByTestId('markdown-view')).toHaveTextContent('Phoneme Guide');
  });

  it('keeps OS Trash checkbox unchecked by default in Safe Set Removal AlertDialog', async () => {
    const user = userEvent.setup();
    const manifest = makeManifest({
      sets: [
        makeSet({ id: 'set-1', name: 'Normal G4', subfolderName: 'G4' }),
        makeSet({ id: 'set-2', name: 'Soft D4', subfolderName: 'D4', scale: 'D4' })
      ]
    });
    const bridge = makeBridge({ manifest });
    const deleteSpy = vi.spyOn(bridge.project, 'deleteRecordingSet');

    resetAppStore(bridge);
    await useAppStore.getState().init();
    await useAppStore.getState().openProject(manifest.rootPath);

    renderWithI18n(<ProjectScreen />);
    const removeButtons = await screen.findAllByTestId('set-remove-btn');

    // First removal: default unchecked -> trashWavFiles: false
    await user.click(removeButtons[0]!);
    const firstDialog = await screen.findByTestId('remove-set-dialog');
    const firstCheckbox = within(firstDialog).getByTestId('remove-set-trash-checkbox');
    expect(firstCheckbox).toHaveAttribute('aria-checked', 'false');
    await user.click(within(firstDialog).getByTestId('remove-set-confirm'));

    await waitFor(() =>
      expect(deleteSpy).toHaveBeenCalledWith({
        rootPath: '/voicebanks/teto',
        setId: 'set-1',
        trashWavFiles: false
      })
    );

    // Second removal: opt-in checked -> trashWavFiles: true
    const remainingRemove = await screen.findByTestId('set-remove-btn');
    await user.click(remainingRemove);
    const secondDialog = await screen.findByTestId('remove-set-dialog');
    const secondCheckbox = within(secondDialog).getByTestId('remove-set-trash-checkbox');
    expect(secondCheckbox).toHaveAttribute('aria-checked', 'false');
    await user.click(secondCheckbox);
    expect(secondCheckbox).toHaveAttribute('aria-checked', 'true');
    await user.click(within(secondDialog).getByTestId('remove-set-confirm'));

    await waitFor(() =>
      expect(deleteSpy).toHaveBeenLastCalledWith({
        rootPath: '/voicebanks/teto',
        setId: 'set-2',
        trashWavFiles: true
      })
    );
  });
});
