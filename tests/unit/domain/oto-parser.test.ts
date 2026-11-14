import {
  attachOtoSyllables,
  parseOtoIni,
  parseReclist,
  serializeOtoIni
} from '@shared/parsers';
import { describe, expect, it } from 'vitest';

describe('parseOtoIni, serializeOtoIni & syllable mapping', () => {
  it('parses UTAU oto.ini entries and skips comments or malformed lines', () => {
    const rawOto = [
      '# comment line',
      '; ini comment',
      '_a_ba_pa.wav=- a,1200.0,150.0,-350.0,50.0,16.7',
      '_a_ba_pa.wav=ba,1700,150,-350,50,16.7',
      'ka.wav=,100,40,-60,20,10',
      'malformed_line_without_numbers=foo,bar'
    ].join('\r\n');

    const parsed = parseOtoIni(rawOto);
    expect(parsed).toEqual([
      {
        fileName: '_a_ba_pa.wav',
        alias: '- a',
        offsetMs: 1200,
        consonantMs: 150,
        cutoffMs: -350,
        preutteranceMs: 50,
        overlapMs: 16.7
      },
      {
        fileName: '_a_ba_pa.wav',
        alias: 'ba',
        offsetMs: 1700,
        consonantMs: 150,
        cutoffMs: -350,
        preutteranceMs: 50,
        overlapMs: 16.7
      },
      {
        fileName: 'ka.wav',
        alias: '',
        offsetMs: 100,
        consonantMs: 40,
        cutoffMs: -60,
        preutteranceMs: 20,
        overlapMs: 10
      }
    ]);
  });

  it('serializes oto.ini with aliasSuffix (_G4), synthesizes blank aliases from fileStem, and avoids duplicating suffixes', () => {
    const entries = parseOtoIni(
      [
        '_a_a_a.wav=- a,1207.1,128.6,-300,42.9,14.3',
        '_a_a_a.wav=a_G4,1635.7,128.6,-300,42.9,14.3',
        'ka.wav=,100,40,-60,20,10'
      ].join('\n')
    );

    const suffixed = serializeOtoIni(entries, '_G4');
    expect(suffixed).toBe(
      [
        '_a_a_a.wav=- a_G4,1207.1,128.6,-300,42.9,14.3',
        '_a_a_a.wav=a_G4,1635.7,128.6,-300,42.9,14.3',
        'ka.wav=ka_G4,100,40,-60,20,10'
      ].join('\n') + '\n'
    );

    const unsuffixed = serializeOtoIni(entries);
    expect(unsuffixed).toBe(
      [
        '_a_a_a.wav=- a,1207.1,128.6,-300,42.9,14.3',
        '_a_a_a.wav=a_G4,1635.7,128.6,-300,42.9,14.3',
        'ka.wav=,100,40,-60,20,10'
      ].join('\n') + '\n'
    );
  });

  it('maps OtoEntry aliases onto matching ReclistEntry.syllables case-insensitively', () => {
    const reclist = parseReclist('_a_ba_pa\nKA\nunmatched\n');
    const oto = parseOtoIni(
      [
        '_A_BA_PA.wav=- a,1200,150,-350,50,16.7',
        '_a_ba_pa.wav=ba,1700,150,-350,50,16.7',
        '_a_ba_pa.wav=pa,2200,150,-350,50,16.7',
        'G4\\ka.wav=,100,40,-60,20,10'
      ].join('\n')
    );

    const attached = attachOtoSyllables(reclist, oto);
    expect(attached[0]?.syllables).toEqual(['- a', 'ba', 'pa']);
    expect(attached[1]?.syllables).toEqual(['ka']);
    expect(attached[2]?.syllables).toEqual([]);
  });
});
