import type { LiveVisualFeed } from './live-visual-feed';
import { type OtoMarker, type OtoMarkerKind, formatCents } from './studio-math';

/** Minimal 2D context surface used by the renderer (lets tests pass a recording mock). */
export type StudioDrawContext = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'globalAlpha'
  | 'fillRect'
  | 'clearRect'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'stroke'
  | 'fillText'
  | 'setLineDash'
  | 'save'
  | 'restore'
> & {
  imageSmoothingEnabled?: boolean;
  drawImage?: CanvasRenderingContext2D['drawImage'];
};

export interface ReviewVisual {
  mins: Float32Array;
  maxs: Float32Array;
  spectrogram: readonly Float32Array[];
  pitchTrack: ReadonlyArray<number | null>;
  durationMs: number;
  peakDb: number;
}

export interface StudioCanvasLabels {
  live: string;
  review: string;
  empty: string;
  target: string;
  noPitch: string;
  oto: Record<OtoMarkerKind, string>;
}

export interface StudioFrameInput {
  width: number;
  height: number;
  mode: 'live' | 'review' | 'empty';
  feed: LiveVisualFeed;
  review: ReviewVisual | null;
  /** Visual-only gain for quiet takes (1 = off). */
  zoomGain: number;
  targetNote: string;
  otoMarkers: OtoMarker[];
  showOtoGrid: boolean;
  /** 0..1 playback position, or `null` when not playing. */
  playbackProgress: number | null;
  labels: StudioCanvasLabels;
}

export interface StudioLayout {
  plotWidth: number;
  meterX: number;
  meterWidth: number;
  waveTop: number;
  waveHeight: number;
  specTop: number;
  specHeight: number;
  pitchTop: number;
  pitchHeight: number;
}

/** Maximum cents deviation shown in the pitch lane (±). */
export const PITCH_LANE_RANGE_CENTS = 600;
const IN_TUNE_CENTS = 25;

export const OTO_MARKER_COLORS: Record<OtoMarkerKind, string> = {
  offset: '#60a5fa',
  overlap: '#34d399',
  preutterance: '#f87171',
  consonant: '#fbbf24',
  cutoff: '#a78bfa'
};

export function computeLayout(width: number, height: number): StudioLayout {
  const meterWidth = 14;
  const plotWidth = Math.max(1, width - meterWidth - 10);
  const waveHeight = Math.round(height * 0.42);
  const specHeight = Math.round(height * 0.36);
  return {
    plotWidth,
    meterX: width - meterWidth - 2,
    meterWidth,
    waveTop: 0,
    waveHeight,
    specTop: waveHeight,
    specHeight,
    pitchTop: waveHeight + specHeight,
    pitchHeight: Math.max(1, height - waveHeight - specHeight)
  };
}

/** 256-entry "studio inferno" heat palette as `[r, g, b]` triples. */
export const HEAT_PALETTE: ReadonlyArray<readonly [number, number, number]> = (() => {
  const stops: Array<[number, [number, number, number]]> = [
    [0, [9, 9, 11]],
    [0.25, [49, 18, 110]],
    [0.5, [168, 36, 132]],
    [0.75, [249, 115, 22]],
    [1, [253, 230, 138]]
  ];
  const out: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s = 0;
    while (s < stops.length - 2 && t > stops[s + 1]![0]) s++;
    const [t0, c0] = stops[s]!;
    const [t1, c1] = stops[s + 1]!;
    const f = (t - t0) / (t1 - t0);
    out.push([
      Math.round(c0[0] + (c1[0] - c0[0]) * f),
      Math.round(c0[1] + (c1[1] - c0[1]) * f),
      Math.round(c0[2] + (c1[2] - c0[2]) * f)
    ] as const);
  }
  return out;
})();

const HEAT_CSS: readonly string[] = HEAT_PALETTE.map(([r, g, b]) => `rgb(${r},${g},${b})`);

export function heatColor(value: number): string {
  const idx = Math.min(255, Math.max(0, Math.round(value * 255)));
  return HEAT_CSS[idx]!;
}

/** Maps cents-from-target to a y coordinate inside the pitch lane (target line = center). */
export function centsToY(cents: number, layout: StudioLayout): number {
  const clamped = Math.max(-PITCH_LANE_RANGE_CENTS, Math.min(PITCH_LANE_RANGE_CENTS, cents));
  const mid = layout.pitchTop + layout.pitchHeight / 2;
  return mid - (clamped / PITCH_LANE_RANGE_CENTS) * (layout.pitchHeight / 2 - 4);
}

/** dBFS (-60..0) to meter fill fraction. */
export function dbToMeterFraction(db: number): number {
  return Math.min(1, Math.max(0, (db + 60) / 60));
}

function drawBackground(ctx: StudioDrawContext, input: StudioFrameInput, layout: StudioLayout) {
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, input.width, input.height);
  ctx.fillStyle = '#0f0f13';
  ctx.fillRect(0, layout.specTop, layout.plotWidth, layout.specHeight);
  ctx.fillStyle = '#0c0c10';
  ctx.fillRect(0, layout.pitchTop, layout.plotWidth, layout.pitchHeight);
  // Waveform center line
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const mid = layout.waveTop + layout.waveHeight / 2;
  ctx.moveTo(0, mid);
  ctx.lineTo(layout.plotWidth, mid);
  ctx.stroke();
}

function drawLiveWaveform(ctx: StudioDrawContext, input: StudioFrameInput, layout: StudioLayout) {
  const slice = input.feed.latest?.waveformSlice;
  if (!slice || slice.length < 2) return;
  const mid = layout.waveTop + layout.waveHeight / 2;
  const amp = layout.waveHeight / 2 - 4;
  ctx.strokeStyle = input.feed.latest?.clipped ? '#f87171' : '#22d3ee';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < slice.length; i++) {
    const x = (i / (slice.length - 1)) * layout.plotWidth;
    const y = mid - Math.max(-1, Math.min(1, slice[i] ?? 0)) * amp;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawReviewWaveform(
  ctx: StudioDrawContext,
  review: ReviewVisual,
  input: StudioFrameInput,
  layout: StudioLayout
) {
  const mid = layout.waveTop + layout.waveHeight / 2;
  const amp = layout.waveHeight / 2 - 4;
  const n = review.mins.length;
  if (n === 0) return;
  const colWidth = layout.plotWidth / n;
  ctx.fillStyle = '#22d3ee';
  for (let c = 0; c < n; c++) {
    const hi = Math.min(1, (review.maxs[c] ?? 0) * input.zoomGain);
    const lo = Math.max(-1, (review.mins[c] ?? 0) * input.zoomGain);
    const top = mid - hi * amp;
    const h = Math.max(1, (hi - lo) * amp);
    ctx.fillRect(c * colWidth, top, Math.max(1, colWidth), h);
  }
}

function drawSpectrogram(
  ctx: StudioDrawContext,
  columns: readonly Float32Array[],
  capacity: number,
  layout: StudioLayout
) {
  if (columns.length === 0) return;
  const total = Math.max(columns.length, capacity);
  const colWidth = layout.plotWidth / total;
  const startX = layout.plotWidth - columns.length * colWidth;
  for (let c = 0; c < columns.length; c++) {
    const bands = columns[c]!;
    const bandHeight = layout.specHeight / bands.length;
    for (let b = 0; b < bands.length; b++) {
      const v = bands[b] ?? 0;
      if (v < 0.04) continue;
      ctx.fillStyle = heatColor(v);
      // Low frequencies at the bottom.
      const y = layout.specTop + layout.specHeight - (b + 1) * bandHeight;
      ctx.fillRect(startX + c * colWidth, y, Math.ceil(colWidth), Math.ceil(bandHeight));
    }
  }
}

function drawPitchLane(
  ctx: StudioDrawContext,
  track: ReadonlyArray<number | null>,
  capacity: number,
  input: StudioFrameInput,
  layout: StudioLayout
) {
  // ±100-cent semitone guides
  ctx.strokeStyle = '#1f1f26';
  ctx.lineWidth = 1;
  for (const cents of [-500, -400, -300, -200, -100, 100, 200, 300, 400, 500]) {
    const y = centsToY(cents, layout);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.plotWidth, y);
    ctx.stroke();
  }
  // Target note line
  const targetY = centsToY(0, layout);
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#e4e4e7';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, targetY);
  ctx.lineTo(layout.plotWidth, targetY);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${input.labels.target} ${input.targetNote}`, 4, targetY - 2);

  if (track.length === 0) return;
  const total = Math.max(track.length, capacity);
  const step = layout.plotWidth / total;
  const startX = layout.plotWidth - track.length * step;
  ctx.lineWidth = 2;
  let drawing = false;
  let lastInTune: boolean | null = null;
  for (let i = 0; i < track.length; i++) {
    const cents = track[i];
    if (cents === null || cents === undefined) {
      if (drawing) ctx.stroke();
      drawing = false;
      continue;
    }
    const x = startX + i * step;
    const y = centsToY(cents, layout);
    const inTune = Math.abs(cents) <= IN_TUNE_CENTS;
    if (!drawing || inTune !== lastInTune) {
      if (drawing) {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.strokeStyle = inTune ? '#a3e635' : '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(x, y);
      drawing = true;
      lastInTune = inTune;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (drawing) ctx.stroke();
}

function drawMeter(ctx: StudioDrawContext, input: StudioFrameInput, layout: StudioLayout) {
  const latest = input.feed.latest;
  const rmsDb = input.mode === 'live' ? (latest?.rmsDb ?? -120) : -120;
  const peakDb =
    input.mode === 'live' ? (latest?.peakDb ?? -120) : (input.review?.peakDb ?? -120);
  ctx.fillStyle = '#18181b';
  ctx.fillRect(layout.meterX, 0, layout.meterWidth, input.height);
  const rmsH = dbToMeterFraction(rmsDb) * input.height;
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(layout.meterX + 2, input.height - rmsH, layout.meterWidth - 4, rmsH);
  const peakFrac = dbToMeterFraction(peakDb);
  const peakY = input.height - peakFrac * input.height;
  ctx.fillStyle = peakDb >= -0.1 ? '#ef4444' : peakDb > -6 ? '#facc15' : '#e4e4e7';
  ctx.fillRect(layout.meterX, peakY, layout.meterWidth, 2);
  const holdDb = input.mode === 'live' ? input.feed.peakHold : peakDb;
  if (holdDb >= -0.1 || (input.mode === 'live' && input.feed.clipped)) {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(layout.meterX, 0, layout.meterWidth, 6);
  }
}

function drawOtoGrid(ctx: StudioDrawContext, input: StudioFrameInput, layout: StudioLayout) {
  const review = input.review;
  if (!review || review.durationMs <= 0 || input.otoMarkers.length === 0) return;
  const toX = (ms: number) =>
    Math.max(0, Math.min(layout.plotWidth, (ms / review.durationMs) * layout.plotWidth));
  const gridBottom = layout.specTop + layout.specHeight;
  // Shade fixed consonant regions (offset → consonant)
  const byAlias = new Map<string, { offset?: number; consonant?: number }>();
  for (const m of input.otoMarkers) {
    const entry = byAlias.get(m.alias) ?? {};
    if (m.kind === 'offset') entry.offset = m.timeMs;
    if (m.kind === 'consonant') entry.consonant = m.timeMs;
    byAlias.set(m.alias, entry);
  }
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = OTO_MARKER_COLORS.consonant;
  for (const { offset, consonant } of byAlias.values()) {
    if (offset === undefined || consonant === undefined) continue;
    ctx.fillRect(toX(offset), 0, Math.max(0, toX(consonant) - toX(offset)), gridBottom);
  }
  ctx.restore();

  ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1;
  for (const marker of input.otoMarkers) {
    const x = toX(marker.timeMs);
    ctx.strokeStyle = OTO_MARKER_COLORS[marker.kind];
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, gridBottom);
    ctx.stroke();
    if (marker.kind === 'offset') {
      ctx.fillStyle = OTO_MARKER_COLORS.offset;
      ctx.textAlign = 'left';
      ctx.fillText(marker.alias, x + 3, 14);
    }
  }
  // Legend
  ctx.textAlign = 'right';
  let legendX = layout.plotWidth - 4;
  const kinds: OtoMarkerKind[] = ['cutoff', 'consonant', 'preutterance', 'overlap', 'offset'];
  for (const kind of kinds) {
    ctx.fillStyle = OTO_MARKER_COLORS[kind];
    const label = input.labels.oto[kind];
    ctx.fillText(label, legendX, layout.waveHeight - 14);
    legendX -= label.length * 6 + 12;
  }
}

function drawCursor(ctx: StudioDrawContext, input: StudioFrameInput, layout: StudioLayout) {
  if (input.playbackProgress === null) return;
  const x = Math.max(0, Math.min(1, input.playbackProgress)) * layout.plotWidth;
  ctx.strokeStyle = '#fafafa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, input.height);
  ctx.stroke();
}

function drawHeader(ctx: StudioDrawContext, input: StudioFrameInput) {
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (input.mode === 'live') {
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`● ${input.labels.live}`, 6, 4);
  } else if (input.mode === 'review') {
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(input.labels.review, 6, 4);
  }
}

/** Formats the live pitch readout (`A4 · 441.2 Hz · +8¢`). */
export function formatPitchReadout(feed: LiveVisualFeed, noPitch: string): string {
  const pitch = feed.latest?.pitch;
  if (!pitch || pitch.frequencyHz === null || pitch.noteLabel === null) return noPitch;
  const cents = pitch.centsFromTarget === null ? '' : ` · ${formatCents(pitch.centsFromTarget)}¢`;
  return `${pitch.noteLabel} · ${pitch.frequencyHz.toFixed(1)} Hz${cents}`;
}

/** Renders one full Studio frame. Pure w.r.t. its inputs (no DOM access). */
export function drawStudioFrame(ctx: StudioDrawContext, input: StudioFrameInput): void {
  const layout = computeLayout(input.width, input.height);
  ctx.clearRect(0, 0, input.width, input.height);
  drawBackground(ctx, input, layout);

  if (input.mode === 'live') {
    drawSpectrogram(ctx, input.feed.spectrogram, input.feed.capacity, layout);
    drawLiveWaveform(ctx, input, layout);
    drawPitchLane(ctx, input.feed.pitchHistory, input.feed.capacity, input, layout);
  } else if (input.mode === 'review' && input.review) {
    drawSpectrogram(ctx, input.review.spectrogram, input.review.spectrogram.length, layout);
    drawReviewWaveform(ctx, input.review, input, layout);
    drawPitchLane(ctx, input.review.pitchTrack, input.review.pitchTrack.length, input, layout);
    if (input.showOtoGrid) drawOtoGrid(ctx, input, layout);
    drawCursor(ctx, input, layout);
  } else {
    drawPitchLane(ctx, [], 0, input, layout);
    ctx.fillStyle = '#71717a';
    ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(input.labels.empty, layout.plotWidth / 2, layout.waveHeight / 2);
  }
  drawMeter(ctx, input, layout);
  drawHeader(ctx, input);
}
