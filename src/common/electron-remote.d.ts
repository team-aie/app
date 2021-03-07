/**
 * This file is needed to polyfill types for `@electron/remote`.
 *
 * TODO: Remove this file after their type declarations are fixed.
 * See also: https://github.com/electron/remote/pull/36.
 */

declare module '@electron/remote' {
  import { remote } from 'electron';
  export = remote;
}
