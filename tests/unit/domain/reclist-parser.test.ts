import { parseReclist, sanitizeFileStem } from '@shared/parsers';
import { describe, expect, it } from 'vitest';

describe('parseReclist & sanitizeFileStem', () => {
  it('ignores header lines before standalone start and stops at standalone end', () => {
    const raw = `
      OREMO Header Metadata v1.0
      Author: Singer
      START
      _a_i_u
      _e_o_n
      END
      _ignored_after_end
    `;

    const entries = parseReclist(raw);
    expect(entries.map((e) => e.rawPrompt)).toEqual(['_a_i_u', '_e_o_n']);
    expect(entries.map((e) => e.fileName)).toEqual([
      '_a_i_u.wav',
      '_e_o_n.wav'
    ]);
    expect(entries.map((e) => e.index)).toEqual([0, 1]);
  });

  it('attaches @comment lines in DeepVocal postfix mode and prefix/section mode without eating _@ X-SAMPA prompts', () => {
    const postfixReclist = [
      'start',
      '_ka_ki_ku',
      '@ pronounce crisply',
      '_@_3_@',
      '@ schwa to nurse vowel',
      'end'
    ].join('\r\n');

    const postfixEntries = parseReclist(postfixReclist);
    expect(postfixEntries).toHaveLength(2);
    expect(postfixEntries[0]?.rawPrompt).toBe('_ka_ki_ku');
    expect(postfixEntries[0]?.inlineComment).toBe('pronounce crisply');
    expect(postfixEntries[1]?.rawPrompt).toBe('_@_3_@');
    expect(postfixEntries[1]?.inlineComment).toBe('schwa to nurse vowel');

    const prefixReclist = [
      '@ Soft falsetto',
      '_a_a_a',
      '@ Chest voice',
      '_ka_ka_ka'
    ].join('\n');

    const prefixEntries = parseReclist(prefixReclist);
    expect(prefixEntries).toHaveLength(2);
    expect(prefixEntries[0]?.inlineComment).toBe('Soft falsetto');
    expect(prefixEntries[1]?.inlineComment).toBe('Chest voice');
  });

  it('resolves duplicate filenames case-insensitively without NaN bugs', () => {
    const raw = ['foo', 'FOO', 'foo', 'Foo', 'bar_1', 'bar', 'BAR'].join('\n');
    const entries = parseReclist(raw);

    expect(entries.map((e) => e.fileName)).toEqual([
      'foo.wav',
      'FOO_1.wav',
      'foo_2.wav',
      'Foo_3.wav',
      'bar_1.wav',
      'bar.wav',
      'BAR_2.wav'
    ]);
  });

  it('sanitizes cross-platform forbidden characters and Windows reserved device names safely', () => {
    expect(sanitizeFileStem('a<b>c:d"e/f\\g|h?i*j.wav')).toBe('abcdefghij');
    expect(sanitizeFileStem('trailing.dots...   ')).toBe('trailing.dots');
    expect(sanitizeFileStem('CON')).toBe('_CON');
    expect(sanitizeFileStem('nul')).toBe('_nul');
    expect(sanitizeFileStem('com1')).toBe('_com1');
    expect(sanitizeFileStem('...')).toBe('');

    const entries = parseReclist('con\nCON\nvalid?name*\n???\n');
    expect(entries.map((e) => e.fileName)).toEqual([
      '_con.wav',
      '_CON_1.wav',
      'validname.wav'
    ]);
  });
});
