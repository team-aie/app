import log from 'electron-log';
import React, { FC, MouseEventHandler } from 'react';
import { useLocalStorage, usePrevious } from 'react-use';

import { Consumer, RecordingSet } from '../../types';
import { checkFileExistence, getLSKey, join } from '../../utils';

import { ConfigureRecordingSet } from './configure-recording-set';
import './show-details.scss';
import './index.scss';
import { PreviewPage } from './preview-page';

const DELTA_ENGLISH_STATE_FILEPATH_MAP = {
  'oto-ini': join('external', 'delta_eng_ver5', 'mkototemp.ini'),
  'list-preview': join('external', 'delta_eng_ver5', 'デルタ式engver5_reclist.txt'),
  dvcfg: join('external', 'To be added later'),
};

const CVVC_NORMAL_STATE_FILEPATH_MAP = {
  'oto-ini': join('external', 'z.cvvc_normal', 'oto.ini'),
  'list-preview': join('external', 'z.cvvc_normal', 'Reclist.txt'),
  dvcfg: join('external', 'To be added later'),
};

const CUST_LIST_STATE_FILEPATH_MAP = {
  'oto-ini': join('external', 'oto.ini'),
  'list-preview': join('external', 'Reclist.txt'),
  dvcfg: join('external', 'voice.dvcfg'),
};

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

  const updatePaths = async (listName: string, isBuiltIn: boolean) => {
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
      log.error(error);
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
          log.error(new Error(`Unknown metadata pageState: ${currentState}`));
          throw new Error(`Unknown metadata pageState: ${currentState} from ${dropDownStates}`);
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
