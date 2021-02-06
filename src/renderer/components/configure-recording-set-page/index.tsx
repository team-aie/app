import chokidar from 'chokidar';
import log from 'electron-log';
import React, { FC } from 'react';
import { useLocalStorage, usePrevious } from 'react-use';

import { getLSKey } from '../../utils';
import { checkPaths } from '../../utils/configure-recording-index-utils';

import { ConfigureRecordingSet } from './configure-recording-set';
import './show-details.scss';
import './index.scss';
import { PreviewPage } from './preview-page';
import { SetMetaClickProps } from './set-meta-configuration';

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
const ConfigureRecordingSetPage: FC<SetMetaClickProps> = ({ onSettingsButtonClick, onNext, onBack, onSetSelected }) => {
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

  const [dropDownStates = [], setDropdownStateArray] = useLocalStorage<Array<MetadataState>>(
    getLSKey('ConfigureRecordingSetPage', 'dropDownStates'),
    [],
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
    return checkPaths(
      listName,
      isBuiltIn,
      setOtoFilePath,
      setRecFilePath,
      setDvcfgFilePath,
      setMetadataStateIndex,
      setDropdownStateArray,
    );
  };
  const currentState = dropDownStates[metadataStateIndex];

  switch (recordingSetState) {
    case 'home':
    case 'external':
      return (
        <ConfigureRecordingSet
          onSettingsButtonClick={onSettingsButtonClick}
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
