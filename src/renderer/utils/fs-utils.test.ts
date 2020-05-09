import path from 'path';

import { readFile } from './fs-utils';

const ENCODING_LINE_ENDING_MAP = {
  lf: ['utf-8', 'utf-8-bom', 'utf-16be', 'utf-16be-bom', 'utf-16le', 'utf-16le-bom'],
  crlf: ['utf-8', 'utf-8-bom', 'utf-16be', 'utf-16be-bom', 'utf-16le', 'utf-16le-bom', 'shift_jis'],
};

const JAPANESE_FILE_CONTENT = `_あ-
_い-
_う-
_え-
_お-
_ん-
`;

describe('readFile utility', () => {
  describe('for text files containing Japanese', () => {
    Object.entries(ENCODING_LINE_ENDING_MAP).forEach(([lineEnding, supportingEncodings]) => {
      supportingEncodings.forEach((supportingEncoding) => {
        describe(`with ${lineEnding} ending`, () => {
          // FIXME: Disabling these cases because we can't complete them without using 'detect-character-encoding'
          if (
            !(lineEnding === 'lf' && supportingEncoding === 'utf-16be') &&
            !(lineEnding === 'lf' && supportingEncoding === 'utf-16le') &&
            !(lineEnding === 'crlf' && supportingEncoding === 'utf-16be')
          ) {
            it(`should read ${supportingEncoding} encoded files correctly`, async () => {
              expect.hasAssertions();

              const testFilePath = path.join(
                __dirname,
                '__test_resources__',
                `${supportingEncoding}-${lineEnding}.txt`,
              );
              const content = await readFile(testFilePath);

              expect(content).toBe(JAPANESE_FILE_CONTENT);
            });
          }
        });
      });
    });
  });
});
