import type { OtoEntry, ScaleNote } from '@shared/types';
import { useEffect, useMemo, useRef } from 'react';
import type { LiveVisualFeed } from './live-visual-feed';
import {
  type ReviewVisual,
  type StudioCanvasLabels,
  drawStudioFrame,
  formatPitchReadout
} from './studio-canvas-draw';
import {
  amplitudeToDb,
  buildOtoMarkers,
  computeAutoZoomGain,
  computeMinMaxEnvelope,
  computePeak,
  computePitchTrack,
  computeSpectrogramColumns
} from './studio-math';
import { useStudioT } from './studio-strings';
import type { PlaybackClock, StudioTakeBuffer } from './types';

export interface StudioCanvasProps {
  /** `true` while a take is being captured (live telemetry mode). */
  isLive: boolean;
  feed: LiveVisualFeed;
  /** In-memory take for 0 ms review rendering (`null` = nothing recorded yet). */
  take: StudioTakeBuffer | null;
  targetNote: ScaleNote;
  /** `oto.ini` entries matching the current `.wav` (read-only display). */
  otoEntries: OtoEntry[];
  showOtoGrid: boolean;
  autoZoomQuietTakes: boolean;
  playback: PlaybackClock | null;
  height?: number;
}

const ENVELOPE_COLUMNS = 1200;
const FALLBACK_WIDTH = 960;
const FALLBACK_HEIGHT = 240;

export function computeReviewVisual(take: StudioTakeBuffer, targetNote: ScaleNote): ReviewVisual {
  const { mins, maxs } = computeMinMaxEnvelope(take.samples, ENVELOPE_COLUMNS);
  return {
    mins,
    maxs,
    spectrogram: computeSpectrogramColumns(take.samples, take.sampleRate),
    pitchTrack: computePitchTrack(take.samples, take.sampleRate, targetNote),
    durationMs: take.sampleRate > 0 ? (take.samples.length / take.sampleRate) * 1000 : 0,
    peakDb: amplitudeToDb(computePeak(take.samples))
  };
}

/**
 * Unified high-DPI Studio visualizer: live oscilloscope + scrolling 64-band
 * spectrogram + f0 lane + dB meter while recording; instant review render of
 * the in-memory take with read-only `oto.ini` grid and playback cursor.
 */
export function StudioCanvas(props: StudioCanvasProps) {
  const t = useStudioT();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const explicitHeight = props.height;

  const review = useMemo(
    () => (props.take && props.take.samples.length > 0 ? computeReviewVisual(props.take, props.targetNote) : null),
    [props.take, props.targetNote]
  );
  const zoomGain = useMemo(
    () =>
      props.autoZoomQuietTakes && props.take ? computeAutoZoomGain(computePeak(props.take.samples)) : 1,
    [props.autoZoomQuietTakes, props.take]
  );
  const otoMarkers = useMemo(
    () => (review ? buildOtoMarkers(props.otoEntries, review.durationMs) : []),
    [props.otoEntries, review]
  );
  const labels = useMemo<StudioCanvasLabels>(
    () => ({
      live: t('canvas.live'),
      review: t('canvas.review'),
      empty: t('canvas.empty'),
      target: t('pitch.target'),
      noPitch: t('pitch.noPitch'),
      oto: {
        offset: t('canvas.otoOffset'),
        overlap: t('canvas.otoOverlap'),
        preutterance: t('canvas.otoPreutterance'),
        consonant: t('canvas.otoConsonant'),
        cutoff: t('canvas.otoCutoff')
      }
    }),
    [t]
  );

  const latest = useRef({ props, review, zoomGain, otoMarkers, labels, explicitHeight });
  latest.current = { props, review, zoomGain, otoMarkers, labels, explicitHeight };

  const ctxRef = useRef<CanvasRenderingContext2D | null | undefined>(undefined);

  const draw = useRef(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (ctxRef.current === undefined) {
      try {
        ctxRef.current = canvas.getContext('2d');
      } catch {
        ctxRef.current = null;
      }
    }
    const ctx = ctxRef.current;
    const { props: p, review: r, zoomGain: g, otoMarkers: m, labels: l, explicitHeight: h } = latest.current;
    if (readoutRef.current) {
      readoutRef.current.textContent = p.isLive ? formatPitchReadout(p.feed, l.noPitch) : '';
    }
    if (!ctx) return;
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    const cssWidth = canvas.clientWidth || wrapperRef.current?.clientWidth || FALLBACK_WIDTH;
    const cssHeight = canvas.clientHeight || wrapperRef.current?.clientHeight || h || FALLBACK_HEIGHT;
    const pxW = Math.round(cssWidth * dpr);
    const pxH = Math.round(cssHeight * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let progress: number | null = null;
    if (p.playback && p.playback.durationMs > 0) {
      progress = (performance.now() - p.playback.startedAtMs) / p.playback.durationMs;
    }
    drawStudioFrame(ctx, {
      width: cssWidth,
      height: cssHeight,
      mode: p.isLive ? 'live' : r ? 'review' : 'empty',
      feed: p.feed,
      review: r,
      zoomGain: g,
      targetNote: p.targetNote,
      otoMarkers: m,
      showOtoGrid: p.showOtoGrid,
      playbackProgress: progress,
      labels: l
    });
  });

  const animating = props.isLive || props.playback !== null;

  // Static frames: redraw whenever inputs change.
  useEffect(() => {
    if (!animating) draw.current();
  });

  // 60 fps loop only while live or playing back.
  useEffect(() => {
    if (!animating || typeof requestAnimationFrame !== 'function') return;
    let raf = 0;
    let lastRevision = -1;
    const tick = () => {
      const { props: p } = latest.current;
      if (p.playback !== null || p.feed.revision !== lastRevision) {
        lastRevision = p.feed.revision;
        draw.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animating]);

  // Redraw on container resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if ((!canvas && !wrapper) || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw.current());
    if (wrapper) ro.observe(wrapper);
    if (canvas) ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const mode = props.isLive ? 'live' : review ? 'review' : 'empty';

  return (
    <div
      ref={wrapperRef}
      className="relative min-h-[160px] w-full flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
    >
      <canvas
        ref={canvasRef}
        data-testid="studio-canvas"
        data-mode={mode}
        data-oto-markers={props.showOtoGrid ? otoMarkers.length : 0}
        aria-label={`${t('canvas.waveform')} · ${t('canvas.spectrogram')} · ${t('canvas.pitchCurve')}`}
        role="img"
        className={explicitHeight !== undefined ? 'block w-full' : 'block h-full w-full'}
        style={explicitHeight !== undefined ? { height: explicitHeight } : undefined}
      />
      <span
        ref={readoutRef}
        data-testid="studio-pitch-readout"
        className="pointer-events-none absolute top-1 right-6 font-mono text-xs text-lime-300 tabular-nums"
        aria-live="off"
      />
    </div>
  );
}
