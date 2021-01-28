import log from 'electron-log';
import React, { FC, MouseEventHandler } from 'react';
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
  const [recordingSetState = 'external' as RecordingPageState, setRecordingSetState] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'recordingSetStateForConfig'),
    'external' as RecordingPageState,
  );
  const [metadataStateIndex = -1, setMetadataStateIndex] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'metadataStaeIndex'),
    -1,
  );
  const prevState = usePrevious(recordingSetState) ?? 'home';
  const [transition = true, setTransition] = useLocalStorage(getLSKey('ConfigureRecordingSetPage', 'transition'), true);
  const [recFilePath = '', setRecFilePath] = useLocalStorage(getLSKey('ConfigureRecordingSetPage', 'recFilePath'), '');
  const [otoFilePath = '', setOtoFilePath] = useLocalStorage(getLSKey('ConfigureRecordingSetPage', 'otoFilePath'), '');
  const [dvcfgFilePath = '', setDvcfgFilePath] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'dvcfgFilePath'),
    '',
  );

  const [dropDownStates = new Array<MetadataState>(), setDropdownStateArray] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'dropDownStates'),
    new Array<MetadataState>(),
  );

  const goToNextDropdownState = () => {
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
            setRecFilePath(listFilePath);
          } else {
            setRecFilePath('');
          }
          if (responses[1] == 'file') {
            states.push('oto-ini');
            setOtoFilePath(otoFilePath);
          } else {
            setOtoFilePath('');
          }
          if (responses[2] == 'file') {
            states.push('dvcfg');
            setDvcfgFilePath(dvcfgFilePath);
          } else {
            setDvcfgFilePath('');
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
  const currentState = dropDownStates[metadataStateIndex];

  switch (recordingSetState) {
    case 'home':
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
      switch (currentState) {
        case 'list-preview':
          return (
            <PreviewPage
              setRecordingSetState={setRecordingSetState}
              pageName="List Preview"
              transition={transition}
              setTransition={setTransition}
              fileName={recFilePath}
              setDropDownState={goToNextDropdownState}
            />
          );
        case 'oto-ini':
          return (
            <PreviewPage
              setRecordingSetState={setRecordingSetState}
              pageName="Oto.ini"
              transition={transition}
              setTransition={setTransition}
              fileName={otoFilePath}
              setDropDownState={goToNextDropdownState}
            />
          );
        case 'dvcfg':
          return (
            <PreviewPage
              setRecordingSetState={setRecordingSetState}
              pageName="Dvcfg"
              transition={transition}
              setTransition={setTransition}
              fileName={dvcfgFilePath}
              setDropDownState={goToNextDropdownState}
            />
          );
        default:
          log.error(new Error(`Unknown pageState: ${recordingSetState}`));
          throw new Error(`Unknown pageState: ${recordingSetState}`);
      }
      break;

    default: {
      const error = new Error(`Unknown pageState: ${recordingSetState}`);
      log.error(error);
      throw error;
    }
  }
};

export default ConfigureRecordingSetPage;
