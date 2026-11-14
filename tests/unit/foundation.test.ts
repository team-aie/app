import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_SCALE_NOTES,
  frequencyHzToPitchDelta,
  scaleNoteToFrequencyHz
} from '@shared/music/chromatic';
import { describe, expect, it } from 'vitest';

describe('Phase 0 Foundation & Asset Integrity', () => {
  it('supports all 48 chromatic target notes from C2 through B5 including sharps', () => {
    expect(ALL_SCALE_NOTES).toHaveLength(48);
    expect(ALL_SCALE_NOTES).toContain('C#3');
    expect(ALL_SCALE_NOTES).toContain('F#4');
    expect(scaleNoteToFrequencyHz('A4')).toBeCloseTo(440, 5);
    expect(frequencyHzToPitchDelta(440, 'A4')).toEqual({
      midiNote: 69,
      noteLabel: 'A4',
      centsFromTarget: 0
    });
  });

  it('preserves all 4 built-in reclists with clean attribution manifests', () => {
    const reclistsRoot = path.resolve('resources/reclists');
    const expectedIds = [
      'delta_eng_ver5',
      'dv_jpn_list_by_alex',
      'extended_cvvc_8lite',
      'z_cvvc_normal'
    ];
    for (const id of expectedIds) {
      const manifestPath = path.join(reclistsRoot, id, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.id).toBe(id);
      expect(fs.existsSync(path.join(reclistsRoot, id, manifest.reclistFile))).toBe(
        true
      );
    }
  });

  it('preserves all 13 legacy character-encoding test fixtures', () => {
    const fixturesDir = path.resolve('tests/fixtures/encodings');
    const files = fs
      .readdirSync(fixturesDir)
      .filter((name) => name.endsWith('.txt'));
    expect(files).toHaveLength(13);
  });
});
