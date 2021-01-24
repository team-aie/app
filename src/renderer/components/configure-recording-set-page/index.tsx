import log from 'electron-log';
import React, { FC, MouseEventHandler, useState } from 'react';
import { useLocalStorage, usePrevious } from 'react-use';

import { Consumer, RecordingSet } from '../../types';
import { checkFileExistence, getLSKey, join } from '../../utils';

import { ConfigureRecordingSet } from './configure-recording-set';
import './show-details.scss';
import './index.scss';
import { PreviewPage } from './preview-page';

/*
 Represents the page states controlled by configure-recording-set.
 'external' represents pages external from this system
  - it's used to determine which transition should be used for the entering home page
*/
export type RecordingPageState = 'home' | 'external' | 'metadata';
export type MetadataState = 'list-preview' | 'oto-ini' | 'dvcfg';

/*
Base page to handle configure-recording-set, dvcfg, oto.ini, and list-preview pages
*/
const ConfigureRecordingSetPage: FC<{
  onNext: MouseEventHandler<HTMLElement>;
  onBack: MouseEventHandler<HTMLElement>;
  onSetSelected: Consumer<RecordingSet>;
}> = ({ onNext, onBack, onSetSelected }) => {
  const [recordingSetState, setRecordingSetState] = useState<RecordingPageState>('external');
  const [metadataStateIndex, setMetadataStateIndex] = useState<number>(-1);
  const prevState = usePrevious(recordingSetState) ?? 'home';
  const [transition, setTransition] = useState<boolean>(true);
  const [filePathRec, setFilePathRec] = useState<string>('');
  const [filePathOto, setFilePathOto] = useState<string>('');
  const [filePathDvcfg, setFilePathDvcfg] = useState<string>('');

  const [dropDownStates, setDropdownStateArray] = useState<MetadataState[]>([]);

  const setDropdownState = () => {
    setMetadataStateIndex((metadataStateIndex + 1) % dropDownStates.length);
  };
  const [chosenBuiltInList = '', rawSetChosenBuiltInList] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'chosenBuiltInList'),
    '',
  );
  const [chosenCustomListPath = '', rawSetChosenCustomListPath] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'chosenCustomListPath'),
    '',
  );

  const updatePaths = (listName: string, isBuiltIn: boolean) => {
    const getFilePath = (metaDataState: MetadataState, listName: string, isBuiltIn: boolean) => {
      let filePath = '';

      const stateToPathDeltaEnglish = {
        'oto-ini': join('external', 'delta_eng_ver5', 'mkototemp.ini'),
        'list-preview': join('external', 'delta_eng_ver5', 'デルタ式engver5_reclist.txt'),
        dvcfg: join('external', 'To be added later'),
      };

      const stateToPathChinese = {
        'oto-ini': join('external', 'z.cvvc_normal', 'oto.ini'),
        'list-preview': join('external', 'z.cvvc_normal', 'Reclist.txt'),
        dvcfg: join('external', 'To be added later'),
      };

      const stateToCustListEnding = {
        'oto-ini': join('external', 'oto.ini'),
        'list-preview': join('external', 'Reclist.txt'),
        dvcfg: join('external', 'voice.dvcfg'),
      };
      if (isBuiltIn) {
        switch (listName) {
          case 'デルタ式英語リストver5 (Delta English Ver. 5)':
            filePath = join(filePath, stateToPathDeltaEnglish[metaDataState]);
            break;
          case 'Z式CVVC-Normal (Z Chinese CVVC - Normal)':
            filePath = join(filePath, stateToPathChinese[metaDataState]);
            break;
        }
      } else {
        filePath = join(listName, stateToCustListEnding[metaDataState]);
      }

      return filePath;
    };

    let isSubscribed = true;

    const otoFilePath = getFilePath('oto-ini', listName, isBuiltIn);
    const listFilePath = getFilePath('list-preview', listName, isBuiltIn);
    const dvcfgFilePath = getFilePath('dvcfg', listName, isBuiltIn);

    const listPromise = checkFileExistence(listFilePath);
    const otoPromise = checkFileExistence(otoFilePath);
    const dvcfgPromise = checkFileExistence(dvcfgFilePath);

    Promise.all([
      otoPromise.catch((error) => {
        return error;
      }),
      listPromise.catch((error) => {
        return error;
      }),
      dvcfgPromise.catch((error) => {
        return error;
      }),
    ])
      .then((responses) => {
        const states: MetadataState[] = [];
        if (isSubscribed) {
          if (responses[0] == 'file') {
            states.push('list-preview');
            setFilePathRec(listFilePath);
          } else {
            setFilePathRec('');
          }
          if (responses[1] == 'file') {
            states.push('oto-ini');
            setFilePathOto(otoFilePath);
          } else {
            setFilePathOto('');
          }
          if (responses[2] == 'file') {
            states.push('dvcfg');
            setFilePathDvcfg(dvcfgFilePath);
          } else {
            setFilePathDvcfg('');
          }
          if (states.length == 0) {
            setMetadataStateIndex(-1);
          } else {
            setDropdownStateArray(states);
            setMetadataStateIndex(0);
          }
        }
      })
      .catch((error) => {
        log.error(error);
        throw error;
      });
    return () => {
      isSubscribed = false;
    };
  };

  switch (recordingSetState) {
    case 'home':
      return (
        <ConfigureRecordingSet
          onNext={onNext}
          onBack={onBack}
          onSetSelected={onSetSelected}
          setRecordingSetState={setRecordingSetState}
          prevState={prevState}
          currState={recordingSetState}
          chosenBuiltInList={chosenBuiltInList}
          rawSetChosenBuiltInList={rawSetChosenBuiltInList}
          chosenCustomListPath={chosenCustomListPath}
          rawSetChosenCustomListPath={rawSetChosenCustomListPath}
          metaDataIndex={metadataStateIndex}
          getFilePath={updatePaths}
        />
      );
    case 'external':
      return (
        <ConfigureRecordingSet
          onNext={onNext}
          onBack={onBack}
          onSetSelected={onSetSelected}
          setRecordingSetState={setRecordingSetState}
          prevState={prevState}
          currState={recordingSetState}
          chosenBuiltInList={chosenBuiltInList}
          rawSetChosenBuiltInList={rawSetChosenBuiltInList}
          chosenCustomListPath={chosenCustomListPath}
          rawSetChosenCustomListPath={rawSetChosenCustomListPath}
          metaDataIndex={metadataStateIndex}
          getFilePath={updatePaths}
        />
      );
    case 'metadata':
      if (dropDownStates[metadataStateIndex] == 'list-preview') {
        return (
          <PreviewPage
            setRecordingSetState={setRecordingSetState}
            pageName="List Preview"
            transition={transition}
            setTransition={setTransition}
            fileName={filePathRec}
            setDropDownState={setDropdownState}
          />
        );
      } else if (dropDownStates[metadataStateIndex] == 'oto-ini') {
        return (
          <PreviewPage
            setRecordingSetState={setRecordingSetState}
            pageName="Oto.ini"
            transition={transition}
            setTransition={setTransition}
            fileName={filePathOto}
            setDropDownState={setDropdownState}
          />
        );
      } else if (dropDownStates[metadataStateIndex] == 'dvcfg') {
        return (
          <PreviewPage
            setRecordingSetState={setRecordingSetState}
            pageName="Dvcfg"
            transition={transition}
            setTransition={setTransition}
            fileName={filePathDvcfg}
            setDropDownState={setDropdownState}
          />
        );
      } else {
        const error = new Error(
          `Unknown metadata pageState: ${dropDownStates[metadataStateIndex]} with index: ${metadataStateIndex}`,
        );
        log.error(error);
        throw error;
      }
    default: {
      const error = new Error(`Unknown pageState: ${recordingSetState}`);
      log.error(error);
      throw error;
    }
  }
};

export default ConfigureRecordingSetPage;
