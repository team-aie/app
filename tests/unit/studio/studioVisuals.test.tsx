import '@testing-library/jest-dom/vitest';
import { scaleNoteToFrequencyHz } from '@shared/music/chromatic';
import type { LiveAudioTelemetry, OtoEntry } from '@shared/types';
import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import { PromptStage } from '@renderer/components/studio';
import { LiveVisualFeed } from '@renderer/components/studio/liveVisualFeed';
import {
  type StudioDrawContext,
  type StudioFrameInput,
  centsToY,
  computeLayout,
  dbToMeterFraction,
  drawStudioFrame,
  formatPitchReadout,
  heatColor
} from '@renderer/components/studio/studioCanvasDraw';
import { computeReviewVisual } from '@renderer/components/studio/StudioCanvas';
import {
  analyzeTake,
  buildOtoMarkers,
  computeAutoZoomGain,
  computeMinMaxEnvelope,
  computePitchTrack,
  computeSpectrogramColumns,
  filterEntries,
  findNextUnrecordedIndex,
  foldSpectrumToBands,
  formatCents,
  joinPath,
  otoEntriesForFile
} from '@renderer/components/studio/studioMath';
import { makeCleanTake, makeClippedTake, makeCutoffTake, makeEntries } from './fixtures';

afterEach(() => cleanup());

function sine(freq: number, sampleRate: number, seconds: number, amp = 0.5): Float32Array {
  const out = new Float32Array(Math.floor(sampleRate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

function telemetry(overrides: Partial<LiveAudioTelemetry> = {}): LiveAudioTelemetry {
  return {
    rmsDb: -18,
    peakDb: -6,
    clipped: false,
    pitch: { frequencyHz: 392, clarity: 0.97, midiNote: 67, noteLabel: 'G4', centsFromTarget: 8 },
    spectrumBands: new Float32Array(64).fill(0.5),
    waveformSlice: sine(4, 512, 1),
    elapsedMs: 100,
    ...overrides
  };
}

describe('studioMath — take hygiene', () => {
  it('flags clipping, early cutoff and quiet takes', () => {
    const clean = makeCleanTake();
    expect(analyzeTake('a.wav', clean.samples, clean.sampleRate)).toMatchObject({
      clipped: false,
      earlyCutoffWarning: false,
      quiet: false,
      durationMs: 500
    });
    const clipped = makeClippedTake();
    expect(analyzeTake('a.wav', clipped.samples, clipped.sampleRate).clipped).toBe(true);
    const cut = makeCutoffTake();
    expect(analyzeTake('a.wav', cut.samples, cut.sampleRate).earlyCutoffWarning).toBe(true);
    const quiet = makeCleanTake(0.02);
    expect(analyzeTake('a.wav', quiet.samples, quiet.sampleRate).quiet).toBe(true);
  });

  it('auto-zoom gain only boosts quiet takes, capped at 16x', () => {
    expect(computeAutoZoomGain(0.8)).toBe(1);
    expect(computeAutoZoomGain(0.1)).toBeCloseTo(9, 5);
    expect(computeAutoZoomGain(0.001)).toBe(16);
    expect(computeAutoZoomGain(0)).toBe(1);
  });

  it('computes a min/max envelope per column', () => {
    const { mins, maxs } = computeMinMaxEnvelope(new Float32Array([0, 1, -1, 0.5]), 2);
    expect(Array.from(maxs)).toEqual([1, 0.5]);
    expect(Array.from(mins)).toEqual([0, -1]);
  });
});

describe('studioMath — spectral & pitch analysis', () => {
  it('folds FFT bins into 64 normalized log bands', () => {
    const bins = new Float32Array(1024).fill(-120);
    bins[100] = -20; // ~2.3 kHz at 48 kHz / 2048
    const bands = foldSpectrumToBands(bins, 48000);
    expect(bands).toHaveLength(64);
    expect(Math.max(...bands)).toBe(1);
    expect(Math.min(...bands)).toBe(0);
  });

  it('offline spectrogram puts a 1 kHz tone energy in a mid band', () => {
    const cols = computeSpectrogramColumns(sine(1000, 16000, 0.5), 16000, 20);
    expect(cols.length).toBeGreaterThan(0);
    const col = cols[Math.floor(cols.length / 2)]!;
    const loudest = col.indexOf(Math.max(...col));
    expect(loudest).toBeGreaterThan(20);
    expect(loudest).toBeLessThan(50);
  });

  it('offline pitchy track reports ~0 cents for an in-tune A4 and +100 for A#4', () => {
    const inTune = computePitchTrack(sine(440, 44100, 0.3), 44100, 'A4', 10).filter((c) => c !== null);
    expect(inTune.length).toBeGreaterThan(0);
    for (const c of inTune) expect(Math.abs(c!)).toBeLessThan(10);
    const sharp = computePitchTrack(sine(scaleNoteToFrequencyHz('A#4'), 44100, 0.3), 44100, 'A4', 5);
    expect(sharp.find((c) => c !== null)).toBeCloseTo(100, -1);
    expect(computePitchTrack(new Float32Array(4096), 44100, 'A4', 5).every((c) => c === null)).toBe(true);
  });
});

describe('studioMath — oto grid (read-only), filtering, navigation', () => {
  const oto: OtoEntry = {
    fileName: '_A_KA.wav',
    alias: '- a',
    offsetMs: 100,
    consonantMs: 80,
    cutoffMs: -300,
    preutteranceMs: 60,
    overlapMs: 20
  };

  it('converts oto.ini fields to absolute marker times (UTAU cutoff semantics)', () => {
    const markers = buildOtoMarkers([oto], 1000);
    const at = (kind: string) => markers.find((m) => m.kind === kind)?.timeMs;
    expect(at('offset')).toBe(100);
    expect(at('overlap')).toBe(120);
    expect(at('preutterance')).toBe(160);
    expect(at('consonant')).toBe(180);
    expect(at('cutoff')).toBe(400);
    expect(buildOtoMarkers([{ ...oto, cutoffMs: 250 }], 1000).at(-1)?.timeMs).toBe(750);
    expect(buildOtoMarkers([{ ...oto, cutoffMs: 0 }], 1000).at(-1)?.timeMs).toBe(1000);
    expect(otoEntriesForFile([oto], '_a_ka.wav')).toHaveLength(1);
  });

  it('filters by query and recorded status', () => {
    const entries = makeEntries();
    const recorded = new Set(['_i_ki_shi.wav']);
    expect(filterEntries(entries, '', 'all', recorded)).toHaveLength(4);
    expect(filterEntries(entries, '', 'recorded', recorded)).toHaveLength(1);
    expect(filterEntries(entries, '', 'unrecorded', recorded)).toHaveLength(3);
    expect(filterEntries(entries, '[KA]', 'all', recorded).map((e) => e.index)).toEqual([0]);
    expect(filterEntries(entries, 'steady', 'all', recorded).map((e) => e.index)).toEqual([0]);
  });

  it('finds the next unrecorded item with wrap-around, or null when complete', () => {
    const entries = makeEntries();
    expect(findNextUnrecordedIndex(entries, 0, new Set(['_i_ki_shi.wav']))).toBe(2);
    expect(findNextUnrecordedIndex(entries, 3, new Set(['_i_ki_shi.wav']))).toBe(0);
    expect(findNextUnrecordedIndex(entries, 0, new Set(entries.map((e) => e.fileName)))).toBeNull();
  });

  it('joins paths preserving separator style', () => {
    expect(joinPath('/vb/test/', 'G4', 'a.wav')).toBe('/vb/test/G4/a.wav');
    expect(joinPath('/vb/test', '', 'a.wav')).toBe('/vb/test/a.wav');
    expect(joinPath('C:\\vb\\test', 'G4')).toBe('C:\\vb\\test\\G4');
    expect(formatCents(8.4)).toBe('+8');
    expect(formatCents(-12)).toBe('−12');
    expect(formatCents(0)).toBe('±0');
  });
});

describe('LiveVisualFeed', () => {
  it('keeps a bounded ring of spectrogram columns and pitch history', () => {
    const feed = new LiveVisualFeed(3);
    for (let i = 0; i < 5; i++) feed.push(telemetry({ peakDb: -10 + i }));
    expect(feed.spectrogram).toHaveLength(3);
    expect(feed.pitchHistory).toHaveLength(3);
    expect(feed.peakHold).toBe(-6);
    feed.push(telemetry({ clipped: true }));
    expect(feed.clipped).toBe(true);
    const rev = feed.revision;
    feed.reset();
    expect(feed.latest).toBeNull();
    expect(feed.spectrogram).toHaveLength(0);
    expect(feed.revision).toBeGreaterThan(rev);
    expect(formatPitchReadout(feed, 'none')).toBe('none');
    feed.push(telemetry());
    expect(formatPitchReadout(feed, 'none')).toBe('G4 · 392.0 Hz · +8¢');
  });
});

/** Recording mock of a 2D canvas context. */
function mockContext() {
  const calls: Array<{ op: string; args: unknown[]; style?: string }> = [];
  const ctx: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1
  };
  for (const op of ['fillRect', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fillText', 'setLineDash', 'save', 'restore']) {
    ctx[op] = (...args: unknown[]) =>
      calls.push({ op, args, style: String(op === 'stroke' || op === 'moveTo' ? ctx.strokeStyle : ctx.fillStyle) });
  }
  return { ctx: ctx as unknown as StudioDrawContext, calls };
}

function frameInput(overrides: Partial<StudioFrameInput> = {}): StudioFrameInput {
  return {
    width: 800,
    height: 300,
    mode: 'empty',
    feed: new LiveVisualFeed(),
    review: null,
    zoomGain: 1,
    targetNote: 'G4',
    otoMarkers: [],
    showOtoGrid: true,
    playbackProgress: null,
    labels: {
      live: 'Live',
      review: 'Review',
      empty: 'Press R',
      target: 'Target',
      noPitch: 'No pitch',
      oto: { offset: 'Offset', overlap: 'Overlap', preutterance: 'Preutterance', consonant: 'Consonant', cutoff: 'Cutoff' }
    },
    ...overrides
  };
}

describe('studioCanvasDraw', () => {
  it('lays out waveform / spectrogram / pitch lanes plus a meter', () => {
    const layout = computeLayout(800, 300);
    expect(layout.waveHeight + layout.specHeight + layout.pitchHeight).toBe(300);
    expect(layout.meterX + layout.meterWidth).toBeLessThanOrEqual(800);
    const mid = layout.pitchTop + layout.pitchHeight / 2;
    expect(centsToY(0, layout)).toBe(mid);
    expect(centsToY(100, layout)).toBeLessThan(mid);
    expect(centsToY(5000, layout)).toBe(centsToY(600, layout));
    expect(dbToMeterFraction(0)).toBe(1);
    expect(dbToMeterFraction(-90)).toBe(0);
    expect(heatColor(0)).toBe('rgb(9,9,11)');
  });

  it('empty mode draws the target line and the call-to-action', () => {
    const { ctx, calls } = mockContext();
    drawStudioFrame(ctx, frameInput());
    expect(calls.some((c) => c.op === 'fillText' && c.args[0] === 'Press R')).toBe(true);
    expect(calls.some((c) => c.op === 'fillText' && c.args[0] === 'Target G4')).toBe(true);
  });

  it('live mode draws oscilloscope, spectrogram heat cells, pitch trace and LIVE badge', () => {
    const feed = new LiveVisualFeed(10);
    for (let i = 0; i < 5; i++) feed.push(telemetry());
    const { ctx, calls } = mockContext();
    drawStudioFrame(ctx, frameInput({ mode: 'live', feed }));
    expect(calls.filter((c) => c.op === 'lineTo').length).toBeGreaterThan(500);
    expect(calls.filter((c) => c.op === 'fillRect' && c.style === heatColor(0.5)).length).toBe(5 * 64);
    expect(calls.some((c) => c.op === 'stroke' && c.style === '#a3e635')).toBe(true); // in-tune (+8¢)
    expect(calls.some((c) => c.op === 'fillText' && c.args[0] === '● Live')).toBe(true);
  });

  it('review mode draws the read-only oto grid at the right x positions and the playback cursor', () => {
    const take = { samples: sine(220, 8000, 1), sampleRate: 8000 };
    const review = computeReviewVisual(take, 'A3');
    expect(review.durationMs).toBe(1000);
    const markers = buildOtoMarkers(
      [{ fileName: 'a.wav', alias: '- a', offsetMs: 250, consonantMs: 100, cutoffMs: -500, preutteranceMs: 50, overlapMs: 25 }],
      1000
    );
    const { ctx, calls } = mockContext();
    drawStudioFrame(ctx, frameInput({ mode: 'review', review, otoMarkers: markers, playbackProgress: 0.5 }));
    const plot = computeLayout(800, 300).plotWidth;
    const xs = calls.filter((c) => c.op === 'moveTo').map((c) => c.args[0] as number);
    expect(xs).toContain(plot * 0.25); // offset
    expect(xs).toContain(plot * 0.35); // consonant
    expect(xs).toContain(plot * 0.75); // cutoff
    expect(xs).toContain(plot * 0.5); // cursor
    expect(calls.some((c) => c.op === 'fillText' && c.args[0] === '- a')).toBe(true);

    const hidden = mockContext();
    drawStudioFrame(hidden.ctx, frameInput({ mode: 'review', review, otoMarkers: markers, showOtoGrid: false }));
    expect(hidden.calls.some((c) => c.op === 'fillText' && c.args[0] === '- a')).toBe(false);
  });
});

describe('PromptStage + i18n integration', () => {
  it('renders translated labels from the studio namespace when an i18next instance is provided', async () => {
    const instance = i18next.createInstance();
    await instance.use(initReactI18next).init({
      lng: 'ja-JP',
      resources: { 'ja-JP': { studio: { prompt: { recorded: '録音済み', position: '{{current}} / {{total}} 件' } } } },
      interpolation: { escapeValue: false }
    });
    const entries = makeEntries();
    render(
      <I18nextProvider i18n={instance}>
        <PromptStage previous={null} current={entries[0]!} next={entries[1]!} index={0} total={4} isRecorded />
      </I18nextProvider>
    );
    expect(screen.getByTestId('studio-prompt-recorded')).toHaveTextContent('録音済み');
    expect(screen.getByTestId('studio-prompt-position')).toHaveTextContent('1 / 4 件');
    // Missing keys fall back to the English defaultValue.
    expect(screen.getByTestId('studio-prompt-comment')).toHaveTextContent('Note: Keep it steady');
  });

  it('shows "End of list" on the last prompt', () => {
    const entries = makeEntries();
    render(<PromptStage previous={entries[2]!} current={entries[3]!} next={null} index={3} total={4} isRecorded={false} />);
    expect(screen.getByTestId('studio-prompt-next')).toHaveTextContent('End of list');
    expect(screen.getByTestId('studio-prompt-previous')).toHaveTextContent('_u_ku_su');
    expect(screen.queryByTestId('studio-prompt-hint')).not.toBeInTheDocument();
  });
});
