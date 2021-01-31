/* eslint-disable @typescript-eslint/no-unused-vars */

import { MetadataState } from '../components/configure-recording-set-page';
import { Consumer } from '../types';

import { checkFileExistence, join } from '.';
export const DELTA_ENGLISH_STATE_FILEPATH_MAP = {
  'oto-ini': join('external', 'delta_eng_ver5', 'mkototemp.ini'),
  'list-preview': join('external', 'delta_eng_ver5', 'デルタ式engver5_reclist.txt'),
  dvcfg: join('external', 'To be added later'),
};

export const CVVC_NORMAL_STATE_FILEPATH_MAP = {
  'oto-ini': join('external', 'z.cvvc_normal', 'oto.ini'),
  'list-preview': join('external', 'z.cvvc_normal', 'Reclist.txt'),
  dvcfg: join('external', 'To be added later'),
};

export const CUST_LIST_STATE_FILEPATH_MAP = {
  'oto-ini': join('external', 'oto.ini'),
  'list-preview': join('external', 'Reclist.txt'),
  dvcfg: join('external', 'voice.dvcfg'),
};

export const checkPaths = async (
  listName: string,
  isBuiltIn: boolean,
  setOtoFilePath: Consumer<string>,
  setRecFilePath: Consumer<string>,
  setDvcfgFilePath: Consumer<string>,
  setMetadataStateIndex: Consumer<number>,
  setDropdownStateArray: Consumer<MetadataState[]>,
): Promise<() => void> => {
  const states: MetadataState[] = [];
  let isSubscribed = true;

  const getFilePromise = async (
    metaDataState: MetadataState,
    listName: string,
    isBuiltIn: boolean,
    setFilePath: Consumer<string>,
  ) => {
    let filePath = '';
    if (isBuiltIn) {
      switch (listName) {
        case 'デルタ式英語リストver5 (Delta English Ver. 5)':
          filePath = join(filePath, DELTA_ENGLISH_STATE_FILEPATH_MAP[metaDataState]);
          break;
        case 'Z式CVVC-Normal (Z Chinese CVVC - Normal)':
          filePath = join(filePath, CVVC_NORMAL_STATE_FILEPATH_MAP[metaDataState]);
          break;
      }
    } else {
      filePath = join(listName, CUST_LIST_STATE_FILEPATH_MAP[metaDataState]);
    }

    const response = checkFileExistence(filePath);
    const fileExistenceAnswer = await response;
    if (isSubscribed) {
      if (fileExistenceAnswer == 'file') {
        states.push(metaDataState);
        setFilePath(filePath);
      } else {
        setFilePath('');
      }
    }
  };
  await Promise.all([
    getFilePromise('oto-ini', listName, isBuiltIn, setOtoFilePath),
    getFilePromise('list-preview', listName, isBuiltIn, setRecFilePath),
    getFilePromise('dvcfg', listName, isBuiltIn, setDvcfgFilePath),
  ]).catch((error) => {
    throw error;
  });

  if (states.length == 0) {
    setMetadataStateIndex(-1);
  } else {
    setDropdownStateArray(states);
    setMetadataStateIndex(0);
  }

  return () => {
    isSubscribed = false;
  };
};
