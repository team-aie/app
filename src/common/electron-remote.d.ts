// Because this is for fixing the type definition of @electron/remote.
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * This file is needed to polyfill types for `@electron/remote`.
 *
 * TODO: Remove this file after their type declarations are fixed.
 * See also: https://github.com/electron/remote/pull/36.
 */

interface NodeRequireCache {
  [path: string]: NodeModule;
}

interface NodeExtensions {
  '.js': (m: NodeModule, filename: string) => any;
  '.json': (m: NodeModule, filename: string) => any;
  '.node': (m: NodeModule, filename: string) => any;
  [ext: string]: (m: NodeModule, filename: string) => any;
}
