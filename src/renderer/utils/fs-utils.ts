import fs, { promises as fsp } from 'fs';
import path from 'path';

import { OpenDialogOptions, remote } from 'electron';
import log from 'electron-log';

import { bestEffortDecode } from './buffer-decoders';
import { ensureLF } from './string-utils';

// Direct Imports
export const join = path.join;
export const relative = path.relative;

// Aliases
export async function readFile(filePath: string, rawBuffer?: false): Promise<string>;
export async function readFile(filePath: string, rawBuffer: true): Promise<Buffer>;
// Overloaded above
export async function readFile(filePath: string, rawBuffer?: boolean): Promise<string | Buffer> {
  try {
    const buffer = await fsp.readFile(filePath);
    if (rawBuffer) {
      return buffer;
    } else {
      let decoded: string = await bestEffortDecode(buffer);

      decoded = ensureLF(decoded);

      return decoded;
    }
  } catch (e) {
    const message = `Failed to read file`;
    log.error(message, e);
    throw new Error(`${message} ${filePath}: ${e}`);
  }
}

export const readFolder = fsp.readdir;
export const writeFile = fsp.writeFile;
export const deleteFile = fsp.unlink;
export const deleteFolder = async (filePath: string): Promise<void> => {
  return fsp.rmdir(filePath, { recursive: true });
};
export const createFolder = async (filePath: string): Promise<void> => {
  await fsp.mkdir(filePath, { recursive: true });
};
export const parentFolderName = path.dirname;
export const filename = path.basename;

// New Methods
export const checkFileExistence = async (filePath: string): Promise<'folder' | 'file' | false> => {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  return (await fsp.lstat(filePath)).isDirectory() ? 'folder' : 'file';
};

export const ensureFolderExists = async (folderPath: string, force?: boolean): Promise<void> => {
  const fileExistence = await checkFileExistence(folderPath);
  if (fileExistence === 'folder') {
    log.info('Path already exists and is a folder', folderPath);
    return;
  } else if (fileExistence === 'file') {
    if (!force) {
      log.error('Path exists but is a file', folderPath);
      throw new Error(`Path exists but is a file: ${folderPath}`);
    } else {
      await deleteFile(folderPath);
    }
  }

  return createFolder(folderPath);
};

export const ensureParentFolderExists = async (folderPath: string): Promise<void> => {
  return ensureFolderExists(parentFolderName(folderPath));
};

export async function openFilePicker(
  mode: 'file' | 'folder' | 'new-folder',
  title?: string,
  message?: string,
): Promise<string | null>;
export async function openFilePicker(
  mode: 'file' | 'folder' | 'new-folder',
  multi?: false,
  title?: string,
  message?: string,
): Promise<string | null>;
export async function openFilePicker(
  mode: 'file' | 'folder',
  multi: true,
  title?: string,
  message?: string,
): Promise<string[] | null>;
// Overloaded above
export async function openFilePicker(
  mode: 'file' | 'folder' | 'new-folder',
  multi?: boolean | string,
  title?: string,
  message?: string,
): Promise<string | string[] | null> {
  const properties: OpenDialogOptions['properties'] = [];
  if (multi) {
    if (typeof multi === 'string') {
      [multi, title, message] = [false, multi, title];
    } else {
      properties.push('multiSelections');
    }
  }

  switch (mode) {
    case 'file':
      properties.push('openFile');
      break;
    // Intentional: for new folders we also want to specify opening a directory
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    case 'new-folder':
      properties.push('createDirectory', 'promptToCreate');
    // eslint-disable-next-line no-fallthrough
    case 'folder':
      properties.push('openDirectory');
  }

  const { canceled, filePaths } = await remote.dialog.showOpenDialog({
    title,
    message,
    properties,
  });

  if (canceled || !filePaths.length) {
    return null;
  }

  return multi ? filePaths : filePaths[0];
}

export const writeArrayBufferToFile = async (filePath: string, arrayBuffer: ArrayBuffer): Promise<void> => {
  return writeFile(filePath, Buffer.from(arrayBuffer), 'binary');
};
