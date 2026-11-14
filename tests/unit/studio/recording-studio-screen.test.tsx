import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingStudioScreen, SIDEBAR_PAGE_SIZE } from '@renderer/components/studio';
import {
  type MockBridge,
  installMockBridge,
  makeCleanTake,
  makeClippedTake,
  makeCutoffTake,
  makeManyEntries,
  makeProps,
  makeSet,
  stubCanvas,
  uninstallMockBridge
} from './fixtures';

const keyR = { key: 'r', code: 'KeyR' };
const keyS = { key: 's', code: 'KeyS' };

let bridge: MockBridge;

beforeEach(() => {
  stubCanvas();
  bridge = installMockBridge();
});

afterEach(() => {
  cleanup();
  uninstallMockBridge();
  vi.restoreAllMocks();
});

function current() {
  return screen.getByTestId('studio-prompt-current');
}

async function recordWithHold() {
  fireEvent.keyDown(window, keyR);
  fireEvent.keyUp(window, keyR);
  await waitFor(() => expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'idle'));
}

describe('RecordingStudioScreen — viewport layout, header & prompt carousel', () => {
  it('renders viewport-fitted studio layout, header triggers, pitch selector, and single-row transport', () => {
    render(<RecordingStudioScreen {...makeProps()} />);
    for (const id of [
      'studio-screen',
      'studio-back-btn',
      'studio-target-pitch-select',
      'studio-options-btn',
      'studio-open-in-btn',
      'studio-hotkeys-btn',
      'studio-transport',
      'studio-prev-btn',
      'studio-record-btn',
      'studio-play-btn',
      'studio-scale-btn',
      'studio-next-btn',
      'studio-next-unrecorded-btn',
      'studio-undo-btn',
      'studio-trash-btn',
      'studio-canvas',
      'studio-prompt-current',
      'studio-progress',
      'studio-pagination'
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }

    // Viewport-fitted layout (no vertical scroll overflow on screen or main; dynamic flex canvas)
    const studioScreen = screen.getByTestId('studio-screen');
    expect(studioScreen.className).toContain('h-full');
    expect(studioScreen.className).toContain('overflow-hidden');
    const main = studioScreen.querySelector('main')!;
    expect(main.className).toContain('overflow-hidden');
    expect(main.className).not.toContain('overflow-y-auto');
    expect(main.querySelector('details')).toBeNull();
    expect(screen.getByTestId('studio-canvas').className).toContain('h-full');

    expect(current()).toHaveTextContent('_a_ka_sa');
    expect(screen.getByTestId('studio-prompt-next')).toHaveTextContent('_i_ki_shi');
    expect(screen.getByTestId('studio-prompt-hint')).toHaveTextContent('[a] - [ka] - [sa]');
    expect(screen.getByTestId('studio-prompt-comment')).toHaveTextContent('Keep it steady');
    expect(screen.getByTestId('studio-prompt-filename')).toHaveTextContent('_a_ka_sa.wav');
    expect(within(screen.getByTestId('studio-prompt-syllables')).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId('studio-progress')).toHaveTextContent('1 / 4 recorded');
    expect(screen.getByTestId('studio-scale-btn')).toHaveTextContent('G4 (392 Hz)');
    expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'empty');

    //Shortcuts popover opens from header
    fireEvent.click(screen.getByTestId('studio-hotkeys-btn'));
    expect(screen.getByTestId('studio-hotkeys-popover')).toHaveTextContent('R — Record');
  });

  it('inline Target Pitch quick-selector lists chromatic notes with Hz labels and calls onChangeScale', () => {
    const onChangeScale = vi.fn();
    const { rerender } = render(<RecordingStudioScreen {...makeProps()} />);

    const pitchSelect = screen.getByTestId('studio-target-pitch-select') as HTMLSelectElement;
    // Disabled when onChangeScale is not provided
    expect(pitchSelect).toBeDisabled();
    expect(pitchSelect.value).toBe('G4');
    expect(pitchSelect.options).toHaveLength(48);
    const optionLabels = Array.from(pitchSelect.options).map((o) => o.textContent);
    expect(optionLabels).toContain('G4 · 392 Hz');
    expect(optionLabels).toContain('A4 · 440 Hz');
    expect(optionLabels).toContain('C4 · 262 Hz');

    // Enabled when onChangeScale is provided; selecting a note calls onChangeScale
    rerender(<RecordingStudioScreen {...makeProps({ onChangeScale })} />);
    expect(pitchSelect).toBeEnabled();
    fireEvent.change(pitchSelect, { target: { value: 'A4' } });
    expect(onChangeScale).toHaveBeenCalledWith('A4');
  });

  it('resumes at lastCursorIndex and arrow keys navigate (reporting cursor changes)', () => {
    const props = makeProps({ activeSet: makeSet({ lastCursorIndex: 2 }) });
    render(<RecordingStudioScreen {...props} />);
    expect(current()).toHaveTextContent('_u_ku_su');
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(current()).toHaveTextContent('_i_ki_shi');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(current()).toHaveTextContent('_e_ke_se');
    fireEvent.keyDown(window, { key: 'ArrowDown' }); // clamped at end
    expect(current()).toHaveTextContent('_e_ke_se');
    expect(props.onCursorChange).toHaveBeenLastCalledWith(3);
  });

  it('N jumps to the next unrecorded prompt (skipping recorded ones)', () => {
    render(<RecordingStudioScreen {...makeProps()} />);
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN' });
    expect(current()).toHaveTextContent('_u_ku_su');
  });

  it('suppresses hotkeys while typing in the sidebar search and filters instantly', () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    const search = screen.getByTestId('studio-search');
    search.focus();
    fireEvent.keyDown(search, keyR);
    fireEvent.keyDown(search, { key: ' ', code: 'Space' });
    fireEvent.keyDown(search, { key: 'Backspace' });
    fireEvent.change(search, { target: { value: 'ki' } });
    expect(props.audioAdapter.startRecording).not.toHaveBeenCalled();
    expect(props.audioAdapter.playSamples).not.toHaveBeenCalled();
    const list = screen.getByTestId('studio-item-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list).toHaveTextContent('_i_ki_shi');
  });

  it('filter pills show recorded / unrecorded items', () => {
    render(<RecordingStudioScreen {...makeProps()} />);
    fireEvent.click(screen.getByTestId('studio-filter-recorded'));
    expect(within(screen.getByTestId('studio-item-list')).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('studio-filter-unrecorded'));
    expect(within(screen.getByTestId('studio-item-list')).getAllByRole('listitem')).toHaveLength(3);
  });

  it('paginates a 415-item reclist at 30 items/page, opens on cursor page (4 / 14), and syncs with cursor & filters', () => {
    expect(SIDEBAR_PAGE_SIZE).toBe(30);
    const entries = makeManyEntries(415);
    const props = makeProps({
      activeSet: makeSet({ lastCursorIndex: 116 }),
      bundle: { entries, otoEntries: [], detectedEncoding: 'utf-8' },
      initialRecordedFiles: ['prompt_001.wav', 'prompt_117.wav']
    });
    render(<RecordingStudioScreen {...props} />);

    // Prompt 117 / 415 (0-indexed cursor 116) opens straight onto Page 4 / 14 (indices 90..119)
    expect(screen.getByTestId('studio-prompt-position')).toHaveTextContent('117 / 415');
    expect(screen.getByTestId('studio-page-indicator')).toHaveTextContent('Page 4 / 14');
    const list = screen.getByTestId('studio-item-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(30);
    expect(screen.getByTestId('studio-item-116')).toBeInTheDocument();
    expect(screen.queryByTestId('studio-item-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('studio-item-120')).not.toBeInTheDocument();

    // Manual previous / next page navigation
    fireEvent.click(screen.getByTestId('studio-page-prev'));
    expect(screen.getByTestId('studio-page-indicator')).toHaveTextContent('Page 3 / 14');
    expect(screen.getByTestId('studio-item-60')).toBeInTheDocument();
    expect(screen.queryByTestId('studio-item-116')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('studio-page-next'));
    expect(screen.getByTestId('studio-page-indicator')).toHaveTextContent('Page 4 / 14');

    // Advancing cursor across page boundary (116 -> 117 -> 118 -> 119 -> 120) auto-jumps to Page 5 / 14
    fireEvent.keyDown(window, { key: 'ArrowDown' }); // 117
    fireEvent.keyDown(window, { key: 'ArrowDown' }); // 118
    fireEvent.keyDown(window, { key: 'ArrowDown' }); // 119
    expect(screen.getByTestId('studio-page-indicator')).toHaveTextContent('Page 4 / 14');
    fireEvent.keyDown(window, { key: 'ArrowDown' }); // 120 -> Page 5!
    expect(screen.getByTestId('studio-page-indicator')).toHaveTextContent('Page 5 / 14');
    expect(screen.getByTestId('studio-item-120')).toBeInTheDocument();

    // Changing filter or search query resets page to 1
    fireEvent.click(screen.getByTestId('studio-filter-recorded'));
    expect(screen.getByTestId('studio-page-indicator')).toHaveTextContent('Page 1 / 1');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('studio-filter-all'));
    expect(screen.getByTestId('studio-page-indicator')).toHaveTextContent('Page 1 / 14');
    expect(screen.getByTestId('studio-page-prev')).toBeDisabled();

    fireEvent.click(screen.getByTestId('studio-page-next')); // Page 2 / 14
    expect(screen.getByTestId('studio-page-indicator')).toHaveTextContent('Page 2 / 14');
    fireEvent.change(screen.getByTestId('studio-search'), { target: { value: 'prompt_41' } });
    expect(screen.getByTestId('studio-page-indicator')).toHaveTextContent('Page 1 / 1');
  });
});

describe('RecordingStudioScreen — focus safety & pointer-click blur', () => {
  it('pressing Space while studio-scale-btn has focus does NOT call onTogglePlayback', async () => {
    const props = makeProps({ activeSet: makeSet({ lastCursorIndex: 1 }) });
    render(<RecordingStudioScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'review'));

    const scaleBtn = screen.getByTestId('studio-scale-btn');
    scaleBtn.focus();
    expect(document.activeElement).toBe(scaleBtn);

    const keyDownNotPrevented = fireEvent.keyDown(scaleBtn, { key: ' ', code: 'Space' });
    const keyUpNotPrevented = fireEvent.keyUp(scaleBtn, { key: ' ', code: 'Space' });
    expect(keyDownNotPrevented).toBe(true);
    expect(keyUpNotPrevented).toBe(true);
    expect(props.audioAdapter.playSamples).not.toHaveBeenCalled();

    // Keyboard activation (detail: 0) toggles reference tone while keeping focus on scaleBtn
    fireEvent.click(scaleBtn, { detail: 0 });
    expect(props.audioAdapter.startReferenceTone).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(scaleBtn);
  });

  it('pointer-clicking transport/action buttons blurs them so Space plays back immediately', async () => {
    const props = makeProps({ activeSet: makeSet({ lastCursorIndex: 1 }) });
    render(<RecordingStudioScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'review'));

    // Pointer click on Reference Tone starts tone AND blurs the button
    const scaleBtn = screen.getByTestId('studio-scale-btn');
    scaleBtn.focus();
    expect(document.activeElement).toBe(scaleBtn);
    fireEvent.click(scaleBtn, { detail: 1 });
    expect(props.audioAdapter.startReferenceTone).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(scaleBtn);

    // Subsequent Space press triggers booth playback instead of Reference Tone!
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    await waitFor(() => expect(props.audioAdapter.playSamples).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(window, { key: ' ', code: 'Space' }); // stop playback

    // Overwrite take so Undo is enabled, then verify pointer-click blur across transport buttons
    await recordWithHold();
    await waitFor(() => expect(screen.getByTestId('studio-undo-btn')).toBeEnabled());

    for (const testId of [
      'studio-prev-btn',
      'studio-next-btn',
      'studio-play-btn',
      'studio-next-unrecorded-btn',
      'studio-record-btn'
    ]) {
      const btn = screen.getByTestId(testId);
      btn.focus();
      expect(document.activeElement).toBe(btn);
      fireEvent.click(btn, { detail: 1 });
      expect(document.activeElement).not.toBe(btn);
      if (testId === 'studio-record-btn') {
        fireEvent.click(btn, { detail: 1 });
        await waitFor(() => expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'idle'));
      }
    }

    // Navigate back to index 1 and overwrite so Undo & Trash are enabled, then check their pointer blur
    fireEvent.click(screen.getByTestId('studio-item-1').querySelector('button')!);
    await recordWithHold();
    const undoBtn = screen.getByTestId('studio-undo-btn');
    undoBtn.focus();
    fireEvent.click(undoBtn, { detail: 1 });
    expect(document.activeElement).not.toBe(undoBtn);
    await waitFor(() => expect(bridge.undoLastRetake).toHaveBeenCalled());

    const trashBtn = screen.getByTestId('studio-trash-btn');
    trashBtn.focus();
    fireEvent.click(trashBtn, { detail: 1 });
    expect(document.activeElement).not.toBe(trashBtn);
    fireEvent.click(await screen.findByTestId('studio-trash-cancel'));
  });
});

describe('RecordingStudioScreen — recording pipeline & eye-level warnings', () => {
  it('Hold-to-Record: R down starts (repeat ignored), R up stops, saves into the set folder, 0 ms review', async () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, keyR);
    fireEvent.keyDown(window, { ...keyR, repeat: true });
    expect(props.audioAdapter.startRecording).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'recording');
    expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'live');
    expect(props.audioAdapter.lastRecordingOptions).toMatchObject({
      inputDeviceId: 'mic-1',
      sampleRate: 48000,
      targetNote: 'G4',
      guide: { kind: 'none' }
    });
    fireEvent.keyUp(window, keyR);
    await waitFor(() => expect(bridge.saveTake).toHaveBeenCalledTimes(1));
    expect(bridge.saveTake.mock.calls[0]![0]).toMatchObject({
      projectRootPath: '/voicebanks/test',
      relativeDirectory: 'G4',
      fileName: '_a_ka_sa.wav',
      format: { sampleRate: 48000, bitDepth: 24, removeDcOffset: true }
    });
    await waitFor(() => expect(screen.getByTestId('studio-progress')).toHaveTextContent('2 / 4 recorded'));
    expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'review');
    expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-oto-markers', '5');
    expect(screen.getByTestId('studio-status')).toHaveTextContent('Saved _a_ka_sa.wav');
    expect(screen.queryByTestId('studio-warning-clipping')).not.toBeInTheDocument();
    expect(screen.queryByTestId('studio-warning-cutoff')).not.toBeInTheDocument();
  });

  it('places hygiene warnings and status at eye level directly between PromptStage and StudioCanvas', async () => {
    const props = makeProps({ workflow: { autoAdvance: true } });
    props.audioAdapter.nextTake = makeClippedTake();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { rerender } = render(<RecordingStudioScreen {...props} />);
    await recordWithHold();

    const promptStage = screen.getByTestId('studio-prompt-stage');
    const clippingBadge = await screen.findByTestId('studio-warning-clipping');
    const statusBanner = screen.getByTestId('studio-status');
    const canvas = screen.getByTestId('studio-canvas');
    const transport = screen.getByTestId('studio-transport');

    expect(clippingBadge).toHaveTextContent('0 dBFS');
    // Strictly between PromptStage and StudioCanvas (never below canvas/transport)
    expect(promptStage.compareDocumentPosition(clippingBadge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(clippingBadge.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(promptStage.compareDocumentPosition(statusBanner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(statusBanner.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(canvas.compareDocumentPosition(transport) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await new Promise((r) => setTimeout(r, 10));
    expect(current()).toHaveTextContent('_a_ka_sa');
    expect(alertSpy).not.toHaveBeenCalled();

    // Quiet take warning also renders at eye level above canvas (with autoAdvance off so cursor stays)
    const quietProps = makeProps({ audioAdapter: props.audioAdapter });
    props.audioAdapter.nextTake = makeCleanTake(0.02);
    rerender(<RecordingStudioScreen {...quietProps} />);
    await recordWithHold();
    const quietBadge = await screen.findByTestId('studio-warning-quiet');
    expect(promptStage.compareDocumentPosition(quietBadge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(quietBadge.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('passes the set guide audio to the engine when Guide BGM is on', () => {
    const props = makeProps({ workflow: { guideEnabled: true } });
    render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, keyR);
    expect(props.audioAdapter.lastRecordingOptions?.guide).toEqual({
      kind: 'pitched-metronome',
      bpm: 120,
      leadInBeats: 4,
      moraCount: 3
    });
  });

  it('Toggle-to-Record: first R starts, keyup does nothing, second R stops & saves', async () => {
    const props = makeProps({ workflow: { recordMode: 'toggle' } });
    render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, keyR);
    fireEvent.keyUp(window, keyR);
    expect(props.audioAdapter.stopRecording).not.toHaveBeenCalled();
    expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'recording');
    fireEvent.keyDown(window, keyR);
    await waitFor(() => expect(bridge.saveTake).toHaveBeenCalledTimes(1));
    expect(props.audioAdapter.stopRecording).toHaveBeenCalledTimes(1);
  });

  it('window blur while holding R stops and saves instead of recording forever', async () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, keyR);
    fireEvent.blur(window);
    await waitFor(() => expect(bridge.saveTake).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'idle');
    fireEvent.keyUp(window, keyR);
    expect(props.audioAdapter.stopRecording).toHaveBeenCalledTimes(1);
  });

  it('locks navigation while recording', () => {
    render(<RecordingStudioScreen {...makeProps()} />);
    fireEvent.keyDown(window, keyR);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(current()).toHaveTextContent('_a_ka_sa');
  });

  it('works standalone without a window.aie bridge (local hygiene analysis)', async () => {
    uninstallMockBridge();
    const props = makeProps();
    props.audioAdapter.nextTake = makeClippedTake();
    render(<RecordingStudioScreen {...props} />);
    await recordWithHold();
    expect(screen.getByTestId('studio-progress')).toHaveTextContent('2 / 4 recorded');
    expect(screen.getByTestId('studio-warning-clipping')).toBeInTheDocument();
  });

  it('shows an early-cutoff badge for chopped takes', async () => {
    const props = makeProps();
    props.audioAdapter.nextTake = makeCutoffTake();
    render(<RecordingStudioScreen {...props} />);
    await recordWithHold();
    expect(await screen.findByTestId('studio-warning-cutoff')).toHaveTextContent('Early cutoff');
  });

  it('Auto-Listen-Back plays the new take, then Auto-Advance moves on when playback ends', async () => {
    const props = makeProps({ workflow: { autoListenBack: true, autoAdvance: true, autoAdvanceDelayMs: 0 } });
    render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, keyR);
    fireEvent.keyUp(window, keyR);
    await waitFor(() => expect(props.audioAdapter.playSamples).toHaveBeenCalledTimes(1));
    const [samples, sampleRate, opts] = props.audioAdapter.playSamples.mock.calls[0]!;
    expect(samples).toBe(props.audioAdapter.nextTake?.samples);
    expect(sampleRate).toBe(8000);
    expect(opts?.outputDeviceId).toBe('spk-1');
    expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'playing');
    expect(current()).toHaveTextContent('_a_ka_sa');
    act(() => props.audioAdapter.finishPlayback());
    await waitFor(() => expect(current()).toHaveTextContent('_i_ki_shi'));
    expect(props.onCursorChange).toHaveBeenLastCalledWith(1);
  });

  it('Auto-Advance without listen-back advances right after a clean save', async () => {
    const props = makeProps({ workflow: { autoAdvance: true, autoAdvanceDelayMs: 0 } });
    render(<RecordingStudioScreen {...props} />);
    await recordWithHold();
    await waitFor(() => expect(current()).toHaveTextContent('_i_ki_shi'));
    expect(props.audioAdapter.playSamples).not.toHaveBeenCalled();
  });

  it('surfaces mic permission errors as a status (no modal) and returns to idle', async () => {
    const props = makeProps();
    const err = new Error('denied');
    err.name = 'NotAllowedError';
    props.audioAdapter.startRecording.mockRejectedValueOnce(err);
    render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, keyR);
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was denied');
    await waitFor(() => expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'idle'));
    fireEvent.keyUp(window, keyR);
    expect(bridge.saveTake).not.toHaveBeenCalled();
  });
});

describe('RecordingStudioScreen — playback, tone, Open In menu, take management', () => {
  it('Space plays an already-recorded take loaded from disk, Space again stops it', async () => {
    const props = makeProps({ activeSet: makeSet({ lastCursorIndex: 1 }) });
    render(<RecordingStudioScreen {...props} />);
    await waitFor(() => expect(bridge.readTakeSamples).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'review'));
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    await waitFor(() => expect(props.audioAdapter.playSamples).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('studio-play-btn')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(props.audioAdapter.stopPlayback).toHaveBeenCalled();
    expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'idle');
  });

  it('navigating away auto-stops playback', async () => {
    const props = makeProps({ activeSet: makeSet({ lastCursorIndex: 1 }) });
    render(<RecordingStudioScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'review'));
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    await waitFor(() => expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'playing'));
    const stops = props.audioAdapter.stopPlayback.mock.calls.length;
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(props.audioAdapter.stopPlayback.mock.calls.length).toBeGreaterThan(stops);
    expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'idle');
  });

  it('S holds the reference tone for the set scale routed to the output device', () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, keyS);
    expect(props.audioAdapter.startReferenceTone).toHaveBeenCalledWith({ note: 'G4', outputDeviceId: 'spk-1' });
    expect(screen.getByTestId('studio-scale-btn')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyUp(window, keyS);
    expect(props.audioAdapter.stopReferenceTone).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('studio-scale-btn')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Delete opens a Radix confirm (never window.confirm) and trashes the take', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const props = makeProps({ activeSet: makeSet({ lastCursorIndex: 1 }) });
    render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, { key: 'Delete' });
    const dialog = await screen.findByTestId('studio-trash-dialog');
    expect(dialog).toHaveTextContent('Move _i_ki_shi.wav to the Trash?');
    // Booth hotkeys are suspended while the dialog is open.
    fireEvent.keyDown(window, keyR);
    expect(props.audioAdapter.startRecording).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('studio-trash-confirm'));
    await waitFor(() =>
      expect(bridge.trashTake).toHaveBeenCalledWith({
        projectRootPath: '/voicebanks/test',
        relativeDirectory: 'G4',
        fileName: '_i_ki_shi.wav'
      })
    );
    await waitFor(() => expect(screen.getByTestId('studio-progress')).toHaveTextContent('0 / 4 recorded'));
    expect(screen.queryByTestId('studio-trash-dialog')).not.toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('Delete on an unrecorded prompt does nothing; cancel keeps the take', async () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(screen.queryByTestId('studio-trash-dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.click(screen.getByTestId('studio-trash-btn'));
    fireEvent.click(await screen.findByTestId('studio-trash-cancel'));
    await waitFor(() => expect(screen.queryByTestId('studio-trash-dialog')).not.toBeInTheDocument());
    expect(bridge.trashTake).not.toHaveBeenCalled();
  });

  it('1-Step Undo Retake is enabled after overwriting a take and calls undoLastRetake', async () => {
    const props = makeProps({ activeSet: makeSet({ lastCursorIndex: 1 }) });
    render(<RecordingStudioScreen {...props} />);
    expect(screen.getByTestId('studio-undo-btn')).toBeDisabled();
    await recordWithHold();
    await waitFor(() => expect(screen.getByTestId('studio-undo-btn')).toBeEnabled());
    fireEvent.click(screen.getByTestId('studio-undo-btn'));
    await waitFor(() =>
      expect(bridge.undoLastRetake).toHaveBeenCalledWith({
        projectRootPath: '/voicebanks/test',
        relativeDirectory: 'G4',
        fileName: '_i_ki_shi.wav'
      })
    );
    expect(await screen.findByTestId('studio-status')).toHaveTextContent('Previous take restored');
    expect(screen.getByTestId('studio-undo-btn')).toBeDisabled();
  });

  it('watchDirectory updates recorded badges quietly when vLabeler/Finder edit the folder', async () => {
    const props = makeProps();
    const { unmount } = render(<RecordingStudioScreen {...props} />);
    expect(bridge.watchDirectory).toHaveBeenCalledWith('/voicebanks/test/G4', expect.any(Function));
    act(() => bridge.emitDirectory(['_a_ka_sa.wav', '_i_ki_shi.wav', '_u_ku_su.wav']));
    expect(screen.getByTestId('studio-progress')).toHaveTextContent('3 / 4 recorded');
    expect(screen.queryByTestId('studio-status')).not.toBeInTheDocument();
    unmount();
    expect(bridge.unsubscribe).toHaveBeenCalled();
  });

  it('root-folder sets save with an empty relativeDirectory', async () => {
    const props = makeProps({ activeSet: makeSet({ targetLocation: 'root', subfolderName: '' }) });
    render(<RecordingStudioScreen {...props} />);
    expect(bridge.watchDirectory).toHaveBeenCalledWith('/voicebanks/test', expect.any(Function));
    await recordWithHold();
    expect(bridge.saveTake.mock.calls[0]![0]).toMatchObject({ relativeDirectory: '' });
  });

  it('Open In ▾ menu + Booth Options ▾ audio settings + sidebar reveal call the right handlers', async () => {
    const onRevealProjectFolder = vi.fn();
    const props = makeProps({ onRevealProjectFolder });
    const { rerender } = render(<RecordingStudioScreen {...props} />);

    // Open In ▾ -> Reveal Voicebank Folder calls onRevealProjectFolder when provided
    fireEvent.click(screen.getByTestId('studio-open-in-btn'));
    expect(screen.getByTestId('studio-open-in-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('studio-reveal-folder'));
    expect(onRevealProjectFolder).toHaveBeenCalledTimes(1);

    // Open In ▾ -> vLabeler & OpenUtau
    fireEvent.click(screen.getByTestId('studio-open-in-btn'));
    fireEvent.click(screen.getByTestId('studio-open-vlabeler'));
    fireEvent.click(screen.getByTestId('studio-open-in-btn'));
    fireEvent.click(screen.getByTestId('studio-open-openutau'));
    await waitFor(() => expect(bridge.openInExternalTool).toHaveBeenCalledTimes(2));
    expect(bridge.openInExternalTool).toHaveBeenCalledWith({ tool: 'vlabeler', projectRootPath: '/voicebanks/test' });

    // Fallback when onRevealProjectFolder is omitted reveals current entry via shell bridge
    rerender(<RecordingStudioScreen {...makeProps()} />);
    fireEvent.click(screen.getByTestId('studio-open-in-btn'));
    fireEvent.click(screen.getByTestId('studio-reveal-folder'));
    expect(bridge.revealInFileManager).toHaveBeenCalledWith('/voicebanks/test/G4/_a_ka_sa.wav');

    // Sidebar per-item reveal button
    fireEvent.click(screen.getByTestId('studio-reveal-1'));
    expect(bridge.revealInFileManager).toHaveBeenCalledWith('/voicebanks/test/G4/_i_ki_shi.wav');

    // Booth Options ▾ -> Audio Settings
    fireEvent.click(screen.getByTestId('studio-options-btn'));
    fireEvent.click(screen.getByTestId('studio-audio-settings'));
    expect(props.onOpenAudioSettings).not.toHaveBeenCalled(); // rerendered with fresh makeProps; check fresh props or back btn
    fireEvent.click(screen.getByTestId('studio-back-btn'));
  });

  it('Booth Options ▾ Audio Settings button triggers onOpenAudioSettings and closes popover', () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    fireEvent.click(screen.getByTestId('studio-options-btn'));
    expect(screen.getByTestId('studio-options-popover')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('studio-audio-settings'));
    expect(props.onOpenAudioSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('studio-options-popover')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('studio-back-btn'));
    expect(props.onBackToProject).toHaveBeenCalledTimes(1);
  });

  it('shows an error status when the external tool cannot be opened', async () => {
    bridge.openInExternalTool.mockResolvedValueOnce({ ok: false, error: 'not configured' });
    render(<RecordingStudioScreen {...makeProps()} />);
    fireEvent.click(screen.getByTestId('studio-open-in-btn'));
    fireEvent.click(screen.getByTestId('studio-open-vlabeler'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open vLabeler: not configured');
  });
});

describe('RecordingStudioScreen — Booth Options ▾ workflow toggles', () => {
  it('mode switch and grouped workflow toggles inside Booth Options ▾ patch prefs and react instantly', async () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    expect(screen.getByTestId('studio-mode-badge')).toHaveTextContent('PTT (Hold R)');

    fireEvent.click(screen.getByTestId('studio-options-btn'));
    const popover = screen.getByTestId('studio-options-popover');
    expect(popover).toHaveTextContent('Recording Behavior');
    expect(popover).toHaveTextContent('Canvas Display');
    expect(screen.getByTestId('studio-mode-toggle')).toHaveAttribute('data-mode', 'hold');

    fireEvent.click(screen.getByTestId('studio-mode-toggle'));
    expect(props.onUpdateWorkflow).toHaveBeenCalledWith({ recordMode: 'toggle' });
    expect(screen.getByTestId('studio-mode-toggle')).toHaveAttribute('data-mode', 'toggle');
    expect(screen.getByTestId('studio-mode-badge')).toHaveTextContent('Toggle R');

    // New mode is live for the keyboard immediately.
    fireEvent.keyDown(window, keyR);
    fireEvent.keyUp(window, keyR);
    expect(screen.getByTestId('studio-screen')).toHaveAttribute('data-phase', 'recording');
    fireEvent.keyDown(window, keyR);
    await waitFor(() => expect(bridge.saveTake).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('studio-toggle-listen-back'));
    expect(props.onUpdateWorkflow).toHaveBeenCalledWith({ autoListenBack: true });
    expect(screen.getByTestId('studio-toggle-listen-back')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('studio-toggle-advance'));
    expect(props.onUpdateWorkflow).toHaveBeenCalledWith({ autoAdvance: true });
    fireEvent.click(screen.getByTestId('studio-toggle-guide'));
    expect(props.onUpdateWorkflow).toHaveBeenCalledWith({ guideEnabled: true });
    fireEvent.click(screen.getByTestId('studio-toggle-oto'));
    expect(props.onUpdateWorkflow).toHaveBeenCalledWith({ showOtoGrid: false });
    fireEvent.click(screen.getByTestId('studio-toggle-zoom'));
    expect(props.onUpdateWorkflow).toHaveBeenCalledWith({ autoZoomQuietTakes: true });
  });

  it('record button works with the mouse as a start/stop toggle', async () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    fireEvent.click(screen.getByTestId('studio-record-btn'));
    expect(props.audioAdapter.startRecording).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('studio-record-btn')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('studio-record-btn'));
    await waitFor(() => expect(bridge.saveTake).toHaveBeenCalledTimes(1));
  });

  it('unmount while recording releases the mic', () => {
    const props = makeProps();
    const { unmount } = render(<RecordingStudioScreen {...props} />);
    fireEvent.keyDown(window, keyR);
    unmount();
    expect(props.audioAdapter.stopRecording).toHaveBeenCalled();
    expect(props.audioAdapter.dispose).not.toHaveBeenCalled(); // external engines are owned by the caller
  });
});
