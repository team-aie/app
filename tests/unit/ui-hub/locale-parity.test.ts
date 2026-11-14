import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createI18n,
  DEFAULT_LOCALE,
  isSupportedLocale,
  NAMESPACES,
  resolveLocale,
  resources,
  SUPPORTED_LOCALES
} from '@shared/i18n';

function flattenLeaves(node: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof node === 'string') {
    out.set(prefix, node);
    return out;
  }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${key}` : key;
      for (const [leafKey, leafVal] of flattenLeaves(value, next)) {
        out.set(leafKey, leafVal);
      }
    }
  }
  return out;
}

function extractPlaceholders(value: string): string[] {
  const matches = value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  return [...new Set(Array.from(matches, (m) => m[1] ?? ''))].sort();
}

/**
 * Keys whose values are universal technical literals, filenames, language
 * endonyms, or pure numeric/unit templates that intentionally match en-US.
 */
const ALLOWED_IDENTICAL_KEYS = new Set([
  'common:appName',
  'common:language.en-US',
  'common:language.zh-CN',
  'common:language.ja-JP',
  'common:language.short.en-US',
  'common:language.short.zh-CN',
  'common:language.short.ja-JP',
  'common:units.progress',
  'common:units.percent',
  'hub:recent.progress',
  'project:editor.builtinMeta',
  'project:editor.encodingOptions.utf-8',
  'project:editor.encodingOptions.utf-16le',
  'project:editor.encodingOptions.utf-16be',
  'project:editor.bpm',
  'project:drawer.tabs.character',
  'project:drawer.columns.index',
  'studio:prompt.position',
  'studio:pitch.hz',
  'studio:meter.db',
  'settings:audio.sampleRateValue'
]);

const HAS_CJK_CHAR = /[\u3040-\u30ff\u3400-\u9fff]/;

describe('3-locale strict i18n parity (en-US, zh-CN, ja-JP)', () => {
  it('bundles all 5 namespaces across en-US, zh-CN, and ja-JP on disk and in memory', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en-US', 'zh-CN', 'ja-JP']);
    expect(NAMESPACES).toEqual(['common', 'hub', 'project', 'studio', 'settings']);

    const localesRoot = path.resolve('src/shared/i18n/locales');
    for (const locale of SUPPORTED_LOCALES) {
      for (const ns of NAMESPACES) {
        const filePath = path.join(localesRoot, locale, `${ns}.json`);
        expect(fs.existsSync(filePath), `Missing ${filePath}`).toBe(true);
        const raw = fs.readFileSync(filePath, 'utf8');
        expect(() => JSON.parse(raw)).not.toThrow();
      }
    }
  });

  it('maintains 100% identical key trees, non-empty strings, and matching {{interpolation}} placeholders', () => {
    for (const ns of NAMESPACES) {
      const enLeaves = flattenLeaves(resources['en-US'][ns]);
      expect(enLeaves.size).toBeGreaterThan(0);

      for (const [key, enVal] of enLeaves) {
        expect(enVal.trim().length, `Empty en-US string at ${ns}:${key}`).toBeGreaterThan(0);
      }

      for (const locale of ['zh-CN', 'ja-JP'] as const) {
        const targetLeaves = flattenLeaves(resources[locale][ns]);

        expect(
          [...targetLeaves.keys()].sort(),
          `Key tree mismatch in ${locale}/${ns}.json`
        ).toEqual([...enLeaves.keys()].sort());

        for (const [key, enVal] of enLeaves) {
          const targetVal = targetLeaves.get(key) ?? '';
          const qualified = `${ns}:${key}`;

          expect(
            targetVal.trim().length,
            `Empty ${locale} translation at ${qualified}`
          ).toBeGreaterThan(0);

          expect(
            extractPlaceholders(targetVal),
            `Placeholder mismatch in ${locale} at ${qualified}: "${targetVal}" vs "${enVal}"`
          ).toEqual(extractPlaceholders(enVal));

          if (!ALLOWED_IDENTICAL_KEYS.has(qualified)) {
            expect(
              targetVal,
              `Untranslated English placeholder left in ${locale} at ${qualified}`
            ).not.toBe(enVal);
            expect(
              HAS_CJK_CHAR.test(targetVal),
              `Expected CJK characters in ${locale} at ${qualified}, got "${targetVal}"`
            ).toBe(true);
          }
        }
      }
    }
  });

  it('uses authentic Japanese and Simplified Chinese vocal-synth domain terminology', () => {
    const jaCorpus = JSON.stringify(resources['ja-JP']);
    for (const term of ['録音リスト', '連続音', '原音設定 (oto.ini)', 'サブバンク', 'ガイドBGM', '先行発声']) {
      expect(jaCorpus).toContain(term);
    }

    const zhCorpus = JSON.stringify(resources['zh-CN']);
    for (const term of ['录音表', '连续音', '原音设定 (oto.ini)', '子音库', '引导 BGM', '先行发声']) {
      expect(zhCorpus).toContain(term);
    }
  });

  it('resolves BCP-47 browser tags and switches active locale synchronously', async () => {
    expect(isSupportedLocale('en-US')).toBe(true);
    expect(isSupportedLocale('zh-CN')).toBe(true);
    expect(isSupportedLocale('ja-JP')).toBe(true);
    expect(isSupportedLocale('fr-FR')).toBe(false);

    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('ja')).toBe('ja-JP');
    expect(resolveLocale('ja-JP')).toBe('ja-JP');
    expect(resolveLocale('zh-Hans-CN')).toBe('zh-CN');
    expect(resolveLocale('zh-TW')).toBe('zh-CN');
    expect(resolveLocale('en-GB')).toBe('en-US');

    const i18n = createI18n({ locale: 'en-US' });
    expect(i18n.t('hub:linkStart')).toBe('Link Start');

    await i18n.changeLanguage('ja-JP');
    expect(i18n.t('hub:linkStart')).toBe('リンク・スタート');
    expect(i18n.t('project:sets.progress', { recorded: 142, total: 365 })).toBe('142 / 365 収録済み');

    await i18n.changeLanguage('zh-CN');
    expect(i18n.t('hub:linkStart')).toBe('连接开始');
    expect(i18n.t('project:sets.progress', { recorded: 142, total: 365 })).toBe('已录制 142 / 365');
  });
});
