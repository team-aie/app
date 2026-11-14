// @vitest-environment node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const KEBAB_FILE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+)+$/;
const KEBAB_DIR_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GOVERNED_ROOTS = ['src', 'tests', 'scripts'] as const;
const EXEMPT_BCP47_LOCALE_DIRS = new Set([
  'src/shared/i18n/locales/en-US',
  'src/shared/i18n/locales/zh-CN',
  'src/shared/i18n/locales/ja-JP'
]);

function collectFsViolations(repoRoot: string): string[] {
  const violations: string[] = [];

  const walk = (relDir: string): void => {
    const absDir = path.join(repoRoot, relDir);
    if (!fs.existsSync(absDir)) return;

    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const relPath = path.posix.join(relDir, entry.name);
      if (entry.isDirectory()) {
        if (!KEBAB_DIR_PATTERN.test(entry.name) && !EXEMPT_BCP47_LOCALE_DIRS.has(relPath)) {
          violations.push(`directory "${relPath}" is not kebab-case`);
        }
        walk(relPath);
      } else if (entry.isFile()) {
        if (!KEBAB_FILE_PATTERN.test(entry.name)) {
          violations.push(`file "${relPath}" does not match ${KEBAB_FILE_PATTERN}`);
        }
      }
    }
  };

  for (const root of GOVERNED_ROOTS) {
    walk(root);
  }
  return violations;
}

function validateRelativePaths(paths: string[]): string[] {
  const violations: string[] = [];
  for (const relPath of paths) {
    const parts = relPath.split('/');
    const fileName = parts[parts.length - 1] ?? '';
    if (!KEBAB_FILE_PATTERN.test(fileName)) {
      violations.push(`git-tracked file "${relPath}" does not match ${KEBAB_FILE_PATTERN}`);
    }
    for (let i = 0; i < parts.length - 1; i += 1) {
      const dirSegment = parts[i]!;
      const dirPrefix = parts.slice(0, i + 1).join('/');
      if (!KEBAB_DIR_PATTERN.test(dirSegment) && !EXEMPT_BCP47_LOCALE_DIRS.has(dirPrefix)) {
        violations.push(`git-tracked directory "${dirPrefix}" is not kebab-case`);
      }
    }
  }
  return violations;
}

describe('Strict kebab-case filename & directory conventions', () => {
  const repoRoot = path.resolve('.');

  it('enforces strict kebab-case across all files and directories on disk in src/, tests/, and scripts/', () => {
    expect(collectFsViolations(repoRoot)).toEqual([]);
  });

  it('enforces exact lowercase kebab-case in the git index (git ls-files) for case-sensitive Linux CI', () => {
    let trackedPaths: string[] = [];
    try {
      const stdout = execFileSync('git', ['ls-files', '--', ...GOVERNED_ROOTS], {
        cwd: repoRoot,
        encoding: 'utf8'
      });
      trackedPaths = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      // Git binary or repository metadata unavailable in exported archive environments.
      return;
    }

    expect(trackedPaths.length).toBeGreaterThan(50);
    expect(validateRelativePaths(trackedPaths)).toEqual([]);
  });
});
