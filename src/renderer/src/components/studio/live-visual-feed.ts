import type { LiveAudioTelemetry } from '@shared/types';
import { SPECTRUM_BAND_COUNT } from './studio-math';

/**
 * Ring-buffered history of live telemetry frames, read by the 60 fps canvas
 * loop without going through React state (zero re-renders per audio frame).
 */
export class LiveVisualFeed {
  readonly capacity: number;
  /** Spectrogram columns, oldest first once full. */
  private readonly columns: Float32Array[] = [];
  /** Pitch history in cents vs. target (`null` = unvoiced). */
  private readonly pitch: Array<number | null> = [];
  private latestFrame: LiveAudioTelemetry | null = null;
  private peakHoldDb = -120;
  private clippedSinceReset = false;
  private version = 0;

  constructor(capacity = 240) {
    this.capacity = capacity;
  }

  push(frame: LiveAudioTelemetry): void {
    this.latestFrame = frame;
    const bands =
      frame.spectrumBands.length === SPECTRUM_BAND_COUNT
        ? new Float32Array(frame.spectrumBands)
        : new Float32Array(SPECTRUM_BAND_COUNT).map((_, i) => frame.spectrumBands[i] ?? 0);
    this.columns.push(bands);
    if (this.columns.length > this.capacity) this.columns.shift();
    this.pitch.push(frame.pitch.centsFromTarget);
    if (this.pitch.length > this.capacity) this.pitch.shift();
    this.peakHoldDb = Math.max(this.peakHoldDb, frame.peakDb);
    if (frame.clipped) this.clippedSinceReset = true;
    this.version++;
  }

  reset(): void {
    this.columns.length = 0;
    this.pitch.length = 0;
    this.latestFrame = null;
    this.peakHoldDb = -120;
    this.clippedSinceReset = false;
    this.version++;
  }

  get latest(): LiveAudioTelemetry | null {
    return this.latestFrame;
  }

  get spectrogram(): readonly Float32Array[] {
    return this.columns;
  }

  get pitchHistory(): ReadonlyArray<number | null> {
    return this.pitch;
  }

  get peakHold(): number {
    return this.peakHoldDb;
  }

  get clipped(): boolean {
    return this.clippedSinceReset;
  }

  /** Monotonic counter bumped on every push/reset (lets the renderer skip idle frames). */
  get revision(): number {
    return this.version;
  }
}
