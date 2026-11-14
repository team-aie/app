import { analyse } from 'chardet';
import iconv from 'iconv-lite';
import type { SupportedEncoding } from '@shared/types';

export type DetectedEncoding = Exclude<SupportedEncoding, 'auto'>;

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function toNodeBuffer(input: Uint8Array | Buffer): Buffer {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

function toIconvEncodingName(encoding: DetectedEncoding): string {
  switch (encoding) {
    case 'utf-8':
      return 'utf-8';
    case 'utf-16le':
      return 'utf-16le';
    case 'utf-16be':
      return 'utf-16be';
    case 'shift_jis':
      return 'shift_jis';
    case 'gb18030':
      return 'gb18030';
  }
}

function isAsciiTextByte(b: number): boolean {
  return b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e);
}

function scoreUtf16CodeUnits(
  bytes: Uint8Array,
  endianness: 'utf-16le' | 'utf-16be'
): number {
  let score = 0;
  const pairCount = Math.floor(bytes.length / 2);
  for (let p = 0; p < pairCount; p++) {
    const b0 = bytes[p * 2]!;
    const b1 = bytes[p * 2 + 1]!;
    const u16 = endianness === 'utf-16le' ? b0 | (b1 << 8) : (b0 << 8) | b1;

    if (u16 === 0x0000) {
      score -= 10;
      continue;
    }
    // Byte-swapped LF (0x0A00) or CR (0x0D00) is a strong indicator of wrong endianness
    if (u16 === 0x0a00 || u16 === 0x0d00 || u16 === 0xfffe || u16 === 0xffff) {
      score -= 25;
      continue;
    }
    if (u16 >= 0xd800 && u16 <= 0xdbff) {
      if (p + 1 < pairCount) {
        const nb0 = bytes[(p + 1) * 2]!;
        const nb1 = bytes[(p + 1) * 2 + 1]!;
        const nextU16 =
          endianness === 'utf-16le' ? nb0 | (nb1 << 8) : (nb0 << 8) | nb1;
        if (nextU16 >= 0xdc00 && nextU16 <= 0xdfff) {
          score += 6;
          p++;
          continue;
        }
      }
      score -= 30;
      continue;
    }
    if (u16 >= 0xdc00 && u16 <= 0xdfff) {
      score -= 30;
      continue;
    }
    if (u16 < 0x0080) {
      score += isAsciiTextByte(u16) ? 6 : -15;
    } else if (u16 >= 0x3000 && u16 <= 0x30ff) {
      // CJK symbols, Hiragana, Katakana
      score += 5;
    } else if (u16 >= 0x3400 && u16 <= 0x9fff) {
      // CJK Unified Ideographs + Ext A
      score += 4;
    } else if (u16 >= 0xff00 && u16 <= 0xffef) {
      // Fullwidth / Halfwidth forms
      score += 3;
    } else if (u16 >= 0x0080 && u16 <= 0x07ff) {
      // Extended Latin / IPA / Cyrillic / etc.
      score += 2;
    } else {
      score += 0.5;
    }
  }
  return score;
}

function detectUtf16WithoutBom(
  bytes: Uint8Array
): 'utf-16le' | 'utf-16be' | null {
  if (bytes.length < 2 || bytes.length % 2 !== 0) {
    return null;
  }

  let nullEven = 0;
  let nullOdd = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    if (bytes[i] === 0x00) {
      nullEven++;
    }
    if (bytes[i + 1] === 0x00) {
      nullOdd++;
    }
  }

  if (nullEven === 0 && nullOdd === 0) {
    return null;
  }

  const leScore = scoreUtf16CodeUnits(bytes, 'utf-16le') + nullOdd * 2;
  const beScore = scoreUtf16CodeUnits(bytes, 'utf-16be') + nullEven * 2;

  if (leScore <= 0 && beScore <= 0) {
    return null;
  }

  return leScore >= beScore ? 'utf-16le' : 'utf-16be';
}

function tryDecodeStrictUtf8(bytes: Uint8Array): string | null {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

function scoreCjkDecodedText(
  text: string,
  candidate: 'shift_jis' | 'gb18030'
): number {
  let score = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xfffd) {
      return -1_000_000_000;
    }
    if (cp >= 0xe000 && cp <= 0xf8ff) {
      score -= 20;
    } else if (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) {
      score -= 20;
    } else if (cp >= 0x3040 && cp <= 0x309f) {
      // Hiragana strongly favors Shift-JIS over GB18030
      score += candidate === 'shift_jis' ? 5 : 1;
    } else if (cp >= 0x30a0 && cp <= 0x30ff) {
      // Fullwidth Katakana strongly favors Shift-JIS over GB18030
      score += candidate === 'shift_jis' ? 5 : 1;
    } else if (cp >= 0x4e00 && cp <= 0x9fff) {
      // CJK Unified Ideographs
      score += 3;
    } else if (cp >= 0x3400 && cp <= 0x4dbf) {
      // CJK Extension A
      score += 2;
    } else if (cp >= 0x20000 && cp <= 0x2fa1f) {
      // 4-byte GB18030 CJK Extensions B..F
      score += 2;
    } else if (cp >= 0xff61 && cp <= 0xff65) {
      // Halfwidth CJK punctuation frequently arises from GB2312 decoded as Shift-JIS
      score -= 4;
    } else if (cp >= 0xff66 && cp <= 0xff9f) {
      // Halfwidth katakana letters (1 byte each -> 2 bytes = +1 vs +3 for a real CJK char)
      score += 0.5;
    }
  }
  return score;
}

function detectLegacyEightBitEncoding(
  bytes: Uint8Array,
  nodeBuffer: Buffer
): { text: string; detectedEncoding: 'shift_jis' | 'gb18030' } {
  const matches = analyse(bytes);
  let sjisConfidence = 0;
  let gbConfidence = 0;

  for (const match of matches) {
    if (match.name === 'Shift_JIS') {
      sjisConfidence = Math.max(sjisConfidence, match.confidence);
    } else if (match.name === 'GB18030') {
      gbConfidence = Math.max(gbConfidence, match.confidence);
    } else if (match.name === 'Big5' && match.lang === 'zh') {
      gbConfidence = Math.max(gbConfidence, match.confidence * 0.5);
    }
  }

  const sjisText = iconv.decode(nodeBuffer, 'shift_jis', { stripBOM: true });
  const gbText = iconv.decode(nodeBuffer, 'gb18030', { stripBOM: true });

  const sjisScore =
    scoreCjkDecodedText(sjisText, 'shift_jis') + sjisConfidence * 0.25;
  const gbScore = scoreCjkDecodedText(gbText, 'gb18030') + gbConfidence * 0.25;

  if (sjisScore >= gbScore) {
    return {
      text: normalizeLineEndings(sjisText.replace(/^\uFEFF/, '')),
      detectedEncoding: 'shift_jis'
    };
  }
  return {
    text: normalizeLineEndings(gbText.replace(/^\uFEFF/, '')),
    detectedEncoding: 'gb18030'
  };
}

export function decodeTextBuffer(
  buffer: Uint8Array | Buffer,
  encoding: SupportedEncoding = 'auto'
): { text: string; detectedEncoding: DetectedEncoding } {
  const nodeBuffer = toNodeBuffer(buffer);
  const bytes = new Uint8Array(
    nodeBuffer.buffer,
    nodeBuffer.byteOffset,
    nodeBuffer.byteLength
  );

  if (encoding !== 'auto') {
    const rawText = iconv.decode(nodeBuffer, toIconvEncodingName(encoding), {
      stripBOM: true
    });
    return {
      text: normalizeLineEndings(rawText.replace(/^\uFEFF/, '')),
      detectedEncoding: encoding
    };
  }

  if (bytes.length === 0) {
    return { text: '', detectedEncoding: 'utf-8' };
  }

  // 1. Deterministic BOM inspection
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    const decoded = iconv.decode(nodeBuffer.subarray(3), 'utf-8', {
      stripBOM: true
    });
    return {
      text: normalizeLineEndings(decoded.replace(/^\uFEFF/, '')),
      detectedEncoding: 'utf-8'
    };
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const decoded = iconv.decode(nodeBuffer.subarray(2), 'utf-16le', {
      stripBOM: true
    });
    return {
      text: normalizeLineEndings(decoded.replace(/^\uFEFF/, '')),
      detectedEncoding: 'utf-16le'
    };
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const decoded = iconv.decode(nodeBuffer.subarray(2), 'utf-16be', {
      stripBOM: true
    });
    return {
      text: normalizeLineEndings(decoded.replace(/^\uFEFF/, '')),
      detectedEncoding: 'utf-16be'
    };
  }

  // 2. BOM-less UTF-16 null-byte & code-unit heuristics
  const utf16Detected = detectUtf16WithoutBom(bytes);
  if (utf16Detected) {
    const decoded = iconv.decode(nodeBuffer, utf16Detected, { stripBOM: true });
    return {
      text: normalizeLineEndings(decoded.replace(/^\uFEFF/, '')),
      detectedEncoding: utf16Detected
    };
  }

  // 3. Pure 7-bit ASCII or strict valid UTF-8
  const strictUtf8 = tryDecodeStrictUtf8(bytes);
  if (strictUtf8 !== null) {
    return {
      text: normalizeLineEndings(strictUtf8.replace(/^\uFEFF/, '')),
      detectedEncoding: 'utf-8'
    };
  }

  // 4. Legacy 8-bit CJK charset detection (Shift-JIS vs GB18030)
  return detectLegacyEightBitEncoding(bytes, nodeBuffer);
}
