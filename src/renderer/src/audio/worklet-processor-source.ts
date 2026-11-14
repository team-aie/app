export const CAPTURE_WORKLET_NAME = 'aie-capture-processor';
export const WORKLET_CHUNK_SIZE = 768;

export type WorkletInboundMessage =
  | { type: 'start'; startAtTime: number }
  | { type: 'stop' }
  | { type: 'dispose' };

export type WorkletOutboundMessage =
  | { type: 'chunk'; samples: Float32Array }
  | { type: 'stopped' };

/**
 * Self-contained ES module source for `AudioWorklet.addModule(blobUrl)`.
 * Embedded directly as a string + `Blob` URL so it works identically across
 * `electron-vite dev` HMR, packaged `app.asar` builds, and Playwright E2E tests.
 */
export const WORKLET_PROCESSOR_SOURCE = `
class AieCaptureWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._active = false;
    this._alive = true;
    this._startAtTime = 0;
    this._buffer = new Float32Array(${WORKLET_CHUNK_SIZE});
    this._writeIndex = 0;

    this.port.onmessage = (event) => {
      const msg = event && event.data;
      if (!msg || typeof msg.type !== 'string') {
        return;
      }
      if (msg.type === 'start') {
        this._startAtTime = typeof msg.startAtTime === 'number' ? msg.startAtTime : 0;
        this._writeIndex = 0;
        this._active = true;
      } else if (msg.type === 'stop') {
        if (this._active) {
          this._flush();
          this._active = false;
        }
        this.port.postMessage({ type: 'stopped' });
      } else if (msg.type === 'dispose') {
        if (this._active) {
          this._flush();
          this._active = false;
        }
        this._alive = false;
      }
    };
  }

  _flush() {
    if (this._writeIndex > 0) {
      const remainder = this._buffer.slice(0, this._writeIndex);
      this.port.postMessage({ type: 'chunk', samples: remainder }, [remainder.buffer]);
      this._buffer = new Float32Array(${WORKLET_CHUNK_SIZE});
      this._writeIndex = 0;
    }
  }

  process(inputs, outputs) {
    if (!this._alive) {
      return false;
    }

    const input = inputs[0];
    const channelCount = input ? input.length : 0;
    const quantumLength = channelCount > 0 && input[0] ? input[0].length : 128;

    const output = outputs[0];
    if (output && output.length > 0) {
      for (let ch = 0; ch < output.length; ch++) {
        const outCh = output[ch];
        if (!outCh) continue;
        if (channelCount > 0) {
          const srcCh = input[Math.min(ch, channelCount - 1)];
          if (srcCh) {
            outCh.set(srcCh);
          } else {
            outCh.fill(0);
          }
        } else {
          outCh.fill(0);
        }
      }
    }

    if (!this._active) {
      return true;
    }

    const now = typeof currentTime === 'number' ? currentTime : 0;
    const sr = typeof sampleRate === 'number' && sampleRate > 0 ? sampleRate : 48000;
    const quantumDuration = quantumLength / sr;

    if (now + quantumDuration <= this._startAtTime) {
      return true;
    }

    let startOffset = 0;
    if (now < this._startAtTime) {
      startOffset = Math.max(
        0,
        Math.min(quantumLength, Math.round((this._startAtTime - now) * sr))
      );
    }

    for (let i = startOffset; i < quantumLength; i++) {
      let monoSample = 0;
      if (channelCount === 1) {
        monoSample = input[0][i] || 0;
      } else if (channelCount > 1) {
        for (let ch = 0; ch < channelCount; ch++) {
          monoSample += input[ch][i] || 0;
        }
        monoSample /= channelCount;
      }

      this._buffer[this._writeIndex++] = monoSample;
      if (this._writeIndex >= ${WORKLET_CHUNK_SIZE}) {
        const fullChunk = this._buffer;
        this.port.postMessage({ type: 'chunk', samples: fullChunk }, [fullChunk.buffer]);
        this._buffer = new Float32Array(${WORKLET_CHUNK_SIZE});
        this._writeIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('${CAPTURE_WORKLET_NAME}', AieCaptureWorkletProcessor);
`;

export function createCaptureWorkletBlobUrl(): string {
  if (
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const blob = new Blob([WORKLET_PROCESSOR_SOURCE], {
      type: 'application/javascript'
    });
    return URL.createObjectURL(blob);
  }
  return `data:application/javascript;charset=utf-8,${encodeURIComponent(WORKLET_PROCESSOR_SOURCE)}`;
}

export function revokeCaptureWorkletBlobUrl(blobUrl: string): void {
  if (
    !blobUrl.startsWith('blob:') ||
    typeof URL === 'undefined' ||
    typeof URL.revokeObjectURL !== 'function'
  ) {
    return;
  }
  try {
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Ignore revoke errors in non-browser test runtimes
  }
}
