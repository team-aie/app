import log from 'electron-log';
import React, { FC, useEffect } from 'react';
import { useAsync, useLocalStorage, usePrevious } from 'react-use';

import recordingListDataService from '../../services/recording-list-data-service';
import { RecordingListData } from '../../services/recording-list-data-service/types';
import { getLSKey } from '../../utils';

import { ConfigureRecordingSet } from './configure-recording-set';
import './show-details.scss';
import './index.scss';
import { PreviewPage } from './preview-page';
import { SetMetaClickProps } from './set-meta-configuration';
import { BuiltInRecordingList } from './types';

/**
 * Represents the page states controlled by configure-recording-set.
 *
 * 'external' represents pages external from this system. It's used to determine which transition should be used for the entering home page.
 */
export type RecordingPageState = 'home' | 'external' | 'metadata';
export type MetadataState = 'list-preview' | 'oto-ini' | 'dvcfg';

/**
 * Base page to handle configure-recording-set, dvcfg, oto.ini, and list-preview pages.
 */
const ConfigureRecordingSetPage: FC<SetMetaClickProps> = ({ onSettingsButtonClick, onNext, onBack, onSetSelected }) => {
  const [recordingSetState = 'external' as RecordingPageState, setRecordingSetState] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'recordingSetStateForConfig'),
    'external' as RecordingPageState,
  );
  const [metadataStateIndex = -1, setMetadataStateIndex] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'metadataStateIndex'),
    -1,
  );
  const prevState = usePrevious(recordingSetState) ?? 'home';
  const [transition = true, setTransition] = useLocalStorage(getLSKey('ConfigureRecordingSetPage', 'transition'), true);

  const [dropDownStates = [], setDropdownStateArray] = useLocalStorage<Array<MetadataState>>(
    getLSKey('ConfigureRecordingSetPage', 'dropDownStates'),
    [],
  );

  const goToNextDropdownState = () => {
    setMetadataStateIndex((metadataStateIndex + 1) % dropDownStates.length);
  };
  const [chosenBuiltInList = '', rawSetChosenBuiltInList] = useLocalStorage<BuiltInRecordingList | ''>(
    getLSKey('ConfigureRecordingSetPage', 'chosenBuiltInList'),
    '',
  );
  const [chosenCustomListPath = '', rawSetChosenCustomListPath] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'chosenCustomListPath'),
    '',
  );

  const [listData, setListData] = useLocalStorage<RecordingListData | undefined>(
    getLSKey('ConfigureRecordingSetPage', 'listData'),
  );

  const useSubscribeToRecordingListSelection = () => {
    useAsync(async () => {
      if (chosenCustomListPath) {
        const nextListData = await recordingListDataService.readData({
          type: 'custom-file',
          filePath: chosenCustomListPath,
        });
        setListData(nextListData);
      } else if (chosenBuiltInList) {
        const nextListData = await recordingListDataService.readData({
          type: 'built-in',
          name: chosenBuiltInList,
        });
        setListData(nextListData);
      } else {
        setListData(undefined);
      }
    }, [chosenBuiltInList, chosenCustomListPath, setListData]);

    useEffect(() => {
      if (listData) {
        const { otoIni, voiceDvcfg } = listData;
        const nextDropDownStates: MetadataState[] = [
          'list-preview',
          ...(otoIni ? ['oto-ini' as MetadataState] : []),
          ...(voiceDvcfg ? ['dvcfg' as MetadataState] : []),
        ];
        setDropdownStateArray(nextDropDownStates);
        setMetadataStateIndex(0);
      } else {
        setDropdownStateArray([]);
        setMetadataStateIndex(-1);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listData, setDropdownStateArray]);
  };

  useSubscribeToRecordingListSelection();

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
              previewContent={listData?.listContent ?? ''}
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
              previewContent={listData?.otoIni ?? ''}
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
              previewContent={listData?.voiceDvcfg ?? ''}
              setDropDownState={goToNextDropdownState}
            />
          );
        default:
          log.error(new Error(`Unknown metadata pageState: ${currentState}`));
          throw new Error(`Unknown metadata pageState: ${currentState} from ${dropDownStates}`);
      }

    default: {
      const error = new Error(`Unknown pageState: ${recordingSetState}`);
      log.error(error);
      throw error;
    }
  }
};

export default ConfigureRecordingSetPage;
