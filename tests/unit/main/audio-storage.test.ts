// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WavFormatConfig } from '@shared/types';
import { createAudioStorage, UnsafePathError } from '../../../src/main/services/audio-storage';
import { watchWavDirectory } from '../../../src/main/services/audio-storage/directory-watcher';
import { analyzeTake, decodeWav, encodeWav } from '../../../src/main/services/audio-storage/wav-codec';

let root: string;
const trashItem = vi.fn(async (_p: string) => undefined);
const fmt = (bitDepth: WavFormatConfig['bitDepth'], removeDcOffset = false): WavFormatConfig => ({
  sampleRate: 44100,
  bitDepth,
  removeDcOffset
});
const sine = (n: number, amp = 0.5, dc = 0): Float32Array =>
  Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / 44100) + dc);
const loc = (fileName = 'a.wav', relativeDirectory = 'G4') => ({
  projectRootPath: root,
  relativeDirectory,
  fileName
});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'aie-audio-'));
  trashItem.mockClear();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('audio-storage save/read', () => {
  it.each([
    [16, 1 / 32767],
    [24, 1 / 8388607],
    [32, 1e-6]
  ] as const)('round-trips %i-bit audio', async (bitDepth, tolerance) => {
    const storage = createAudioStorage({ trashItem });
    const samples = sine(4410);
    const summary = await storage.saveTake({ ...loc(), samples, format: fmt(bitDepth) });
    expect(summary.fullPath).toBe(path.join(root, 'G4', 'a.wav'));
    expect(summary.durationMs).toBeCloseTo(100, 3);
    expect(summary.peakDb).toBeCloseTo(-6.02, 1);
    expect(summary.clipped).toBe(false);
    expect(summary.canUndoPreviousTake).toBe(false);

    const read = await storage.readTakeSamples(loc());
    expect(read?.sampleRate).toBe(44100);
    expect(read?.samples.length).toBe(samples.length);
    let maxErr = 0;
    samples.forEach((s, i) => (maxErr = Math.max(maxErr, Math.abs(s - (read?.samples[i] ?? 0)))));
    expect(maxErr).toBeLessThanOrEqual(tolerance + 1e-7);
  });

  it('writes the right RIFF bit depth', async () => {
    const storage = createAudioStorage({ trashItem });
    for (const [depth, bits, code] of [[16, 16, 1], [24, 24, 1], [32, 32, 3]] as const) {
      await storage.saveTake({ ...loc(`d${depth}.wav`), samples: sine(100), format: fmt(depth) });
      const bytes = fs.readFileSync(path.join(root, 'G4', `d${depth}.wav`));
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(bytes.readUInt16LE(20)).toBe(code);
      expect(bytes.readUInt16LE(34)).toBe(bits);
    }
  });

  it('removes DC offset when requested', async () => {
    const storage = createAudioStorage({ trashItem });
    await storage.saveTake({ ...loc('dc.wav'), samples: sine(4410, 0.2, 0.3), format: fmt(32, true) });
    const read = await storage.readTakeSamples(loc('dc.wav'));
    const mean = (read?.samples ?? new Float32Array()).reduce((a, b) => a + b, 0) / 4410;
    expect(Math.abs(mean)).toBeLessThan(1e-4);

    await storage.saveTake({ ...loc('keep.wav'), samples: sine(4410, 0.2, 0.3), format: fmt(32, false) });
    const kept = await storage.readTakeSamples(loc('keep.wav'));
    const keptMean = (kept?.samples ?? new Float32Array()).reduce((a, b) => a + b, 0) / 4410;
    expect(keptMean).toBeGreaterThan(0.25);
  });

  it('returns null for unrecorded takes and flags clipping', async () => {
    const storage = createAudioStorage({ trashItem });
    expect(await storage.readTakeSamples(loc('missing.wav'))).toBeNull();
    const hot = await storage.saveTake({ ...loc('hot.wav'), samples: sine(4410, 1.2), format: fmt(16) });
    expect(hot.clipped).toBe(true);
    expect(hot.peakDb).toBeGreaterThan(-0.1);
  });

  it('flags early cutoff when the take ends mid-sound but not for a clean tail', () => {
    const body = sine(4410, 0.5);
    expect(analyzeTake(body, 44100).earlyCutoffWarning).toBe(true);
    const tail = new Float32Array(8820);
    tail.set(body);
    expect(analyzeTake(tail, 44100).earlyCutoffWarning).toBe(false);
  });

  it('encode/decode keeps sample rate', () => {
    const bytes = encodeWav(sine(480), { sampleRate: 48000, bitDepth: 24, removeDcOffset: false });
    expect(decodeWav(bytes).sampleRate).toBe(48000);
  });
});

describe('1-step undo retake', () => {
  it('backs up the previous take into .aie-cache/undo and restores it', async () => {
    const storage = createAudioStorage({ trashItem });
    const first = sine(4410, 0.3);
    const second = sine(2205, 0.6);
    const s1 = await storage.saveTake({ ...loc(), samples: first, format: fmt(32) });
    expect(s1.canUndoPreviousTake).toBe(false);
    const s2 = await storage.saveTake({ ...loc(), samples: second, format: fmt(32) });
    expect(s2.canUndoPreviousTake).toBe(true);
    expect(fs.existsSync(path.join(root, '.aie-cache', 'undo', 'G4', 'a.wav.bak'))).toBe(true);
    expect((await storage.readTakeSamples(loc()))?.samples.length).toBe(2205);

    expect(await storage.undoLastRetake(loc())).toBe(true);
    const restored = await storage.readTakeSamples(loc());
    expect(restored?.samples.length).toBe(4410);
    expect(Math.abs((restored?.samples[100] ?? 0) - (first[100] ?? 0))).toBeLessThan(1e-6);
    // Only one step of undo.
    expect(await storage.undoLastRetake(loc())).toBe(false);
  });

  it('returns false when there is nothing to undo, and clears stale backups on first take', async () => {
    const storage = createAudioStorage({ trashItem });
    expect(await storage.undoLastRetake(loc())).toBe(false);
    await storage.saveTake({ ...loc(), samples: sine(100), format: fmt(16) });
    await storage.saveTake({ ...loc(), samples: sine(100), format: fmt(16) });
    fs.rmSync(path.join(root, 'G4', 'a.wav'));
    const fresh = await storage.saveTake({ ...loc(), samples: sine(100), format: fmt(16) });
    expect(fresh.canUndoPreviousTake).toBe(false);
  });
});

describe('trash + path safety', () => {
  it('moves takes to the OS trash and never unlinks them', async () => {
    const storage = createAudioStorage({ trashItem });
    await storage.saveTake({ ...loc(), samples: sine(100), format: fmt(16) });
    await storage.trashTake(loc());
    expect(trashItem).toHaveBeenCalledWith(path.join(root, 'G4', 'a.wav'));
    expect(fs.existsSync(path.join(root, 'G4', 'a.wav'))).toBe(true); // the mock does not remove it
    await storage.trashTake(loc('none.wav'));
    expect(trashItem).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['../escape', 'a.wav'],
    ['G4/../../escape', 'a.wav'],
    ['G4', '../a.wav'],
    ['G4', 'sub/a.wav'],
    ['G4', 'sub\\a.wav'],
    ['G4', 'a.txt'],
    ['G4', ''],
    ['/etc', 'a.wav'],
    ['G4\0', 'a.wav']
  ])('rejects dir=%j file=%j', async (relativeDirectory, fileName) => {
    const storage = createAudioStorage({ trashItem });
    await expect(
      storage.saveTake({ ...loc(fileName, relativeDirectory), samples: sine(10), format: fmt(16) })
    ).rejects.toBeInstanceOf(UnsafePathError);
    await expect(storage.readTakeSamples(loc(fileName, relativeDirectory))).rejects.toBeInstanceOf(UnsafePathError);
    await expect(storage.trashTake(loc(fileName, relativeDirectory))).rejects.toBeInstanceOf(UnsafePathError);
    await expect(storage.undoLastRetake(loc(fileName, relativeDirectory))).rejects.toBeInstanceOf(UnsafePathError);
  });

  it('allows an empty relativeDirectory (root-level sets) and rejects relative project roots', async () => {
    const storage = createAudioStorage({ trashItem });
    const s = await storage.saveTake({ ...loc('r.wav', ''), samples: sine(10), format: fmt(16) });
    expect(s.fullPath).toBe(path.join(root, 'r.wav'));
    await expect(
      storage.saveTake({ projectRootPath: 'rel', relativeDirectory: '', fileName: 'a.wav', samples: sine(10), format: fmt(16) })
    ).rejects.toBeInstanceOf(UnsafePathError);
  });
});

describe('watchWavDirectory', () => {
  it('emits wav names after changes and tolerates a missing folder', async () => {
    const dir = path.join(root, 'later');
    const seen: string[][] = [];
    const handle = watchWavDirectory({
      directory: dir,
      debounceMs: 30,
      retryMs: 50,
      onChanged: (names) => seen.push(names)
    });
    await new Promise((r) => setTimeout(r, 120));
    fs.mkdirSync(dir);
    await new Promise((r) => setTimeout(r, 200));
    fs.writeFileSync(path.join(dir, 'x.wav'), 'RIFF');
    fs.writeFileSync(path.join(dir, 'ignored.txt'), 'hi');
    await vi.waitFor(() => expect(seen.at(-1)).toEqual(['x.wav']), { timeout: 4000, interval: 50 });
    await handle.close();
  });
});
