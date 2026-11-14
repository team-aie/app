import fs from 'node:fs';
import path from 'node:path';
import iconv from 'iconv-lite';
import { decodeTextBuffer } from '@shared/parsers';
import { describe, expect, it } from 'vitest';

const EXPECTED_JAPANESE_FIXTURE_CONTENT = `_あ-
_い-
_う-
_え-
_お-
_ん-
`;

describe('decodeTextBuffer charset detection & normalization', () => {
  const fixturesDir = path.resolve('tests/fixtures/encodings');
  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((name) => name.endsWith('.txt'))
    .sort();

  it('discovers all 13 encoding fixtures', () => {
    expect(fixtureFiles).toHaveLength(13);
  });

  for (const fileName of fixtureFiles) {
    it(`auto-detects and decodes legacy fixture "${fileName}" cleanly`, () => {
      const rawBuffer = fs.readFileSync(path.join(fixturesDir, fileName));
      const result = decodeTextBuffer(rawBuffer, 'auto');
      expect(result.text).toBe(EXPECTED_JAPANESE_FIXTURE_CONTENT);
      expect([
        'utf-8',
        'utf-16le',
        'utf-16be',
        'shift_jis',
        'gb18030'
      ]).toContain(result.detectedEncoding);
    });
  }

  it('auto-detects Shift-JIS Japanese reclists, katakana, and oto.ini lines', () => {
    const sjisText =
      '_あいう.wav=あ,100.0,50.0,-50.0,20.0,10.0\r\n連続音テスト\r\nｱｲｳｴｵ\r\n';
    const encoded = iconv.encode(sjisText, 'shift_jis');

    const decoded = decodeTextBuffer(encoded);
    expect(decoded.detectedEncoding).toBe('shift_jis');
    expect(decoded.text).toBe(
      '_あいう.wav=あ,100.0,50.0,-50.0,20.0,10.0\n連続音テスト\nｱｲｳｴｵ\n'
    );
  });

  it('auto-detects GB18030 Chinese reclists, oto.ini aliases, and 4-byte CJK ideographs', () => {
    const samples = [
      '你好\r\n中文录音表\r\n',
      '扩展CVVC 8lite 残月\r\n',
      '_啊_吧_啪.wav=- 啊,1200,150,-350,50,16.7\r\n',
      '录音表㐀𠀀测试\r\n'
    ];

    for (const sample of samples) {
      const encoded = iconv.encode(sample, 'gb18030');
      const decoded = decodeTextBuffer(encoded);
      expect(decoded.detectedEncoding).toBe('gb18030');
      expect(decoded.text).toBe(sample.replace(/\r\n/g, '\n'));
    }
  });

  it('auto-detects BOM-less UTF-16LE and UTF-16BE CJK buffers with surrogate pairs', () => {
    const original = '一二三🎤\r\nかきくけこ\r\n';
    const leBuf = iconv.encode(original, 'utf-16le', { addBOM: false });
    const beBuf = iconv.encode(original, 'utf-16be', { addBOM: false });

    const decodedLe = decodeTextBuffer(leBuf);
    expect(decodedLe.detectedEncoding).toBe('utf-16le');
    expect(decodedLe.text).toBe('一二三🎤\nかきくけこ\n');

    const decodedBe = decodeTextBuffer(beBuf);
    expect(decodedBe.detectedEncoding).toBe('utf-16be');
    expect(decodedBe.text).toBe('一二三🎤\nかきくけこ\n');
  });

  it('honors explicit encoding overrides, Uint8Array views, CR normalization, and empty buffers', () => {
    expect(decodeTextBuffer(new Uint8Array(0))).toEqual({
      text: '',
      detectedEncoding: 'utf-8'
    });

    const macCrText = Buffer.from('_a\r_b\r_c\r', 'utf8');
    expect(decodeTextBuffer(macCrText)).toEqual({
      text: '_a\n_b\n_c\n',
      detectedEncoding: 'utf-8'
    });

    // Subarray with non-zero byteOffset
    const padded = Buffer.concat([
      Buffer.from([0x99, 0x99, 0x99]),
      iconv.encode('中文测试\r\n', 'gb18030'),
      Buffer.from([0x88, 0x88])
    ]);
    const view = new Uint8Array(
      padded.buffer,
      padded.byteOffset + 3,
      padded.byteLength - 5
    );
    const explicitResult = decodeTextBuffer(view, 'gb18030');
    expect(explicitResult).toEqual({
      text: '中文测试\n',
      detectedEncoding: 'gb18030'
    });
  });
});
