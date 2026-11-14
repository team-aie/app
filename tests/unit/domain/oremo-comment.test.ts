import fs from 'node:fs';
import path from 'node:path';
import {
  formatDeltaEngXsampaHint,
  lookupOremoComment,
  parseOremoComment,
  parseReclist
} from '@shared/parsers';
import { describe, expect, it } from 'vitest';

describe('OREMO-comment parser & Delta English Ver.5 X-SAMPA hints', () => {
  it('parses tab-separated and space-separated OREMO-comment.txt maps with .wav stem normalization', () => {
    const raw = [
      '# Comment header',
      '_a_i_u\tあ・い・う',
      '_ka_ki_ku.wav\tか・き・く',
      '_sa_shi_su   さ・し・す (space fallback)'
    ].join('\r\n');

    const map = parseOremoComment(raw);
    expect(
      lookupOremoComment(map, {
        rawPrompt: '_a_i_u',
        fileStem: '_a_i_u',
        fileName: '_a_i_u.wav'
      })
    ).toBe('あ・い・う');
    expect(
      lookupOremoComment(map, {
        rawPrompt: '_ka_ki_ku',
        fileStem: '_ka_ki_ku',
        fileName: '_ka_ki_ku.wav'
      })
    ).toBe('か・き・く');
    expect(
      lookupOremoComment(map, {
        rawPrompt: '_SA_SHI_SU',
        fileStem: '_SA_SHI_SU',
        fileName: '_SA_SHI_SU.wav'
      })
    ).toBe('さ・し・す (space fallback)');
  });

  it('converts Delta English Ver.5 X-SAMPA tokens into clear IPA pronunciation hints', () => {
    expect(formatDeltaEngXsampaHint('_i+_{_i+')).toContain('[ɪ] - [æ] - [ɪ]');
    expect(formatDeltaEngXsampaHint('_t+i+_t+i+_t+-')).toContain(
      '[θɪ] - [θɪ] - [θ-]'
    );
    expect(formatDeltaEngXsampaHint('_d+3_d+3_d+-')).toContain(
      '[ðɜː] - [ðɜː] - [ð-]'
    );
    expect(formatDeltaEngXsampaHint('_ts+@_ts+@_ts+-')).toContain(
      '[tʃə] - [tʃə] - [tʃ-]'
    );
    expect(formatDeltaEngXsampaHint('_dz+@_dz+@_dz+-')).toContain(
      '[dʒə] - [dʒə] - [dʒ-]'
    );
    expect(formatDeltaEngXsampaHint('_n+o+_n+o+_n+-')).toContain(
      '[ŋɔ] - [ŋɔ] - [ŋ-]'
    );
  });

  it('ships complete OREMO-comment.txt hints for all 415 entries in delta_eng_ver5', () => {
    const deltaDir = path.resolve('resources/reclists/delta_eng_ver5');
    const reclistText = fs.readFileSync(
      path.join(deltaDir, 'デルタ式engver5_reclist.txt'),
      'utf8'
    );
    const commentText = fs.readFileSync(
      path.join(deltaDir, 'OREMO-comment.txt'),
      'utf8'
    );

    const commentMap = parseOremoComment(commentText);
    const entries = parseReclist(reclistText, { commentMap });
    expect(entries).toHaveLength(415);

    const target = entries.find((e) => e.rawPrompt === '_i+_{_i+');
    expect(target?.pronunciationHint).toContain('[ɪ] - [æ] - [ɪ]');

    for (const entry of entries) {
      expect(entry.pronunciationHint).toBeTruthy();
      expect(entry.pronunciationHint).toContain('[');
    }
  });
});
