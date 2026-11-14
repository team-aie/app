import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingStudioScreen } from '@renderer/components/studio';
import {
  type MockBridge,
  installMockBridge,
  makeClippedTake,
  makeCutoffTake,
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

describe('RecordingStudioScreen — layout & prompt carousel', () => {
  it('renders every E2E data-testid and the phoneme coach for the current prompt', () => {
    render(<RecordingStudioScreen {...makeProps()} />);
    for (const id of [
      'studio-screen',
      'studio-record-btn',
      'studio-play-btn',
      'studio-scale-btn',
      'studio-canvas',
      'studio-prompt-current',
      'studio-progress',
      'studio-undo-btn',
      'studio-mode-toggle'
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(current()).toHaveTextContent('_a_ka_sa');
    expect(screen.getByTestId('studio-prompt-next')).toHaveTextContent('_i_ki_shi');
    expect(screen.getByTestId('studio-prompt-hint')).toHaveTextContent('[a] - [ka] - [sa]');
    expect(screen.getByTestId('studio-prompt-comment')).toHaveTextContent('Keep it steady');
    expect(screen.getByTestId('studio-prompt-filename')).toHaveTextContent('_a_ka_sa.wav');
    expect(within(screen.getByTestId('studio-prompt-syllables')).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId('studio-progress')).toHaveTextContent('1 / 4 recorded');
    expect(screen.getByTestId('studio-scale-btn')).toHaveTextContent('G4');
    expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-mode', 'empty');
    expect(screen.getByTestId('studio-mode-toggle')).toHaveAttribute('data-mode', 'hold');
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
});

describe('RecordingStudioScreen — recording pipeline', () => {
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

  it('shows a non-blocking clipping badge and does NOT auto-advance after a clipped take', async () => {
    const props = makeProps({ workflow: { autoAdvance: true } });
    props.audioAdapter.nextTake = makeClippedTake();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(<RecordingStudioScreen {...props} />);
    await recordWithHold();
    expect(await screen.findByTestId('studio-warning-clipping')).toHaveTextContent('0 dBFS');
    await new Promise((r) => setTimeout(r, 10));
    expect(current()).toHaveTextContent('_a_ka_sa');
    expect(alertSpy).not.toHaveBeenCalled();
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

describe('RecordingStudioScreen — playback, tone, take management', () => {
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

  it('handoff + reveal buttons call the shell bridge', async () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    fireEvent.click(screen.getByTestId('studio-open-vlabeler'));
    fireEvent.click(screen.getByTestId('studio-open-openutau'));
    await waitFor(() => expect(bridge.openInExternalTool).toHaveBeenCalledTimes(2));
    expect(bridge.openInExternalTool).toHaveBeenCalledWith({ tool: 'vlabeler', projectRootPath: '/voicebanks/test' });
    fireEvent.click(screen.getByTestId('studio-reveal-1'));
    expect(bridge.revealInFileManager).toHaveBeenCalledWith('/voicebanks/test/G4/_i_ki_shi.wav');
    fireEvent.click(screen.getByTestId('studio-audio-settings'));
    expect(props.onOpenAudioSettings).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('studio-back-btn'));
    expect(props.onBackToProject).toHaveBeenCalled();
  });

  it('shows an error status when the external tool cannot be opened', async () => {
    bridge.openInExternalTool.mockResolvedValueOnce({ ok: false, error: 'not configured' });
    render(<RecordingStudioScreen {...makeProps()} />);
    fireEvent.click(screen.getByTestId('studio-open-vlabeler'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open vLabeler: not configured');
  });
});

describe('RecordingStudioScreen — workflow toggles', () => {
  it('mode switch and workflow toggles patch prefs and react instantly', async () => {
    const props = makeProps();
    render(<RecordingStudioScreen {...props} />);
    fireEvent.click(screen.getByTestId('studio-mode-toggle'));
    expect(props.onUpdateWorkflow).toHaveBeenCalledWith({ recordMode: 'toggle' });
    expect(screen.getByTestId('studio-mode-toggle')).toHaveAttribute('data-mode', 'toggle');

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
