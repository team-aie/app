import path from 'node:path';

export class UnsafePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafePathError';
  }
}

/** `true` when `candidate` is `root` itself or strictly inside it. */
export function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export interface TakeLocation {
  projectRootPath: string;
  relativeDirectory: string;
  fileName: string;
}

export interface ResolvedTakePaths {
  root: string;
  directory: string;
  wavPath: string;
  undoPath: string;
}

export const UNDO_CACHE_SEGMENTS = ['.aie-cache', 'undo'] as const;

/**
 * Resolves the `.wav` and its 1-step undo backup, rejecting anything that could
 * escape `projectRootPath` (`..`, absolute paths, separators or NULs in the
 * file name, non-`.wav` targets).
 */
export function resolveTakePaths(location: TakeLocation): ResolvedTakePaths {
  const { projectRootPath, relativeDirectory, fileName } = location;
  if (typeof projectRootPath !== 'string' || !path.isAbsolute(projectRootPath)) {
    throw new UnsafePathError('projectRootPath must be an absolute path');
  }
  if (typeof relativeDirectory !== 'string' || typeof fileName !== 'string') {
    throw new UnsafePathError('relativeDirectory and fileName must be strings');
  }
  if (relativeDirectory.includes('\0') || fileName.includes('\0')) {
    throw new UnsafePathError('Paths must not contain NUL bytes');
  }
  if (path.isAbsolute(relativeDirectory) || /^[a-zA-Z]:/.test(relativeDirectory)) {
    throw new UnsafePathError('relativeDirectory must be relative to the project root');
  }
  if (
    fileName === '' ||
    fileName === '.' ||
    fileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\')
  ) {
    throw new UnsafePathError('fileName must be a bare file name');
  }
  if (!fileName.toLowerCase().endsWith('.wav')) {
    throw new UnsafePathError('fileName must end with .wav');
  }

  const root = path.resolve(projectRootPath);
  const directory = path.resolve(root, relativeDirectory);
  if (!isInside(root, directory)) {
    throw new UnsafePathError('relativeDirectory escapes the project root');
  }
  const wavPath = path.join(directory, fileName);
  const undoRoot = path.join(root, ...UNDO_CACHE_SEGMENTS);
  const undoPath = path.join(undoRoot, path.relative(root, directory), `${fileName}.bak`);
  if (!isInside(root, wavPath) || !isInside(undoRoot, undoPath)) {
    throw new UnsafePathError('Resolved take path escapes the project root');
  }
  return { root, directory, wavPath, undoPath };
}
