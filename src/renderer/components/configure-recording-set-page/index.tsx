import log from 'electron-log';
import React, { FC, MouseEventHandler, useState } from 'react';
import { useLocalStorage, usePrevious } from 'react-use';

import { Consumer, RecordingSet } from '../../types';
import { getLSKey } from '../../utils';

import { ConfigureRecordingSet } from './configure-recording-set';
import './show-details.scss';
import './index.scss';
import { PreviewPage } from './preview-page';
import { BuiltInRecordingList } from './types';

/*
 Represents the page states controlled by configure-recording-set.
 'external' represents pages external from this system
  - it's used to determine which transition should be used for the entering home page
*/
export type RecordingPageState = 'home' | 'list-preview' | 'oto-ini' | 'dvcfg' | 'external';

/*
Base page to handle configure-recording-set, dvcfg, oto.ini, and list-preview pages
*/
const ConfigureRecordingSetPage: FC<{
  onNext: MouseEventHandler<HTMLElement>;
  onBack: MouseEventHandler<HTMLElement>;
  onSetSelected: Consumer<RecordingSet>;
}> = ({ onNext, onBack, onSetSelected }) => {
  const [recordingSetState, setRecordingSetState] = useState<RecordingPageState>('external');
  const prevState = usePrevious(recordingSetState) ?? 'home';
  const [transition, setTransition] = useState<boolean>(true);

  const [recordingSets = [], setRecordingSets] = useLocalStorage<RecordingSet[]>(
    getLSKey('ConfigureRecordingSetPage', 'recordingSets'),
    [],
  );

  const [selectedRecordingSetIndex = -1, setSelectedRecordingSetIndex] = useLocalStorage<number>(
    getLSKey('ConfigureRecordingSetPage', 'selectedRecordingSetIndex'),
    -1,
  );

  let filePathOto = 'external\\';
  let filePathRec = 'external\\';
  let filePathDvcfg = 'external\\';

  if (selectedRecordingSetIndex != -1) {
    const recList = recordingSets[selectedRecordingSetIndex].recordingList;
    if (recList.type === 'built-in') {
      const builtInListName = recList.name as BuiltInRecordingList;
      switch (builtInListName) {
        case 'デルタ式英語リストver5 (Delta English Ver. 5)':
          filePathOto = filePathOto + 'delta_eng_ver5\\mkototemp.ini';
          filePathRec = filePathRec + 'delta_eng_ver5\\デルタ式engver5_reclist.txt';
          filePathDvcfg = filePathDvcfg + ''; //To be addded later

          break;
        case 'Z式CVVC-Normal (Z Chinese CVVC - Normal)':
          filePathOto = filePathOto + 'z.cvvc_normal\\oto.ini';
          filePathRec = filePathRec + 'z.cvvc_normal\\Reclist.txt';
          filePathDvcfg = filePathDvcfg + ''; //To be addded later
          break;
      }
    } else {
      filePathOto = filePathOto + recList.filePath + '\\' + 'oto.ini';
      filePathRec = filePathRec + recList.filePath + '\\' + 'Reclist.txt';
      filePathDvcfg = filePathDvcfg + recList.filePath + '\\' + 'voice.dvcfg';
    }
  }

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
          recordingSets={recordingSets}
          setRecordingSets={setRecordingSets}
          selectedRecordingSetIndex={selectedRecordingSetIndex}
          setSelectedRecordingSetIndex={setSelectedRecordingSetIndex}
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
          recordingSets={recordingSets}
          setRecordingSets={setRecordingSets}
          selectedRecordingSetIndex={selectedRecordingSetIndex}
          setSelectedRecordingSetIndex={setSelectedRecordingSetIndex}
        />
      );
    case 'list-preview':
      return (
        <PreviewPage
          setRecordingSetState={setRecordingSetState}
          leftPage="dvcfg"
          rightPage="oto-ini"
          pageName="List Preview"
          transition={transition}
          setTransition={setTransition}
          fileName={filePathRec}
        />
      );
    case 'oto-ini':
      return (
        <PreviewPage
          setRecordingSetState={setRecordingSetState}
          leftPage="list-preview"
          rightPage="dvcfg"
          pageName="Oto.ini"
          transition={transition}
          setTransition={setTransition}
          fileName={filePathOto}
        />
      );
    case 'dvcfg':
      return (
        <PreviewPage
          setRecordingSetState={setRecordingSetState}
          leftPage="oto-ini"
          rightPage="list-preview"
          pageName="Dvcfg"
          transition={transition}
          setTransition={setTransition}
          fileName={filePathDvcfg}
        />
      );
    default: {
      const error = new Error(`Unknown pageState: ${recordingSetState}`);
      log.error(error);
      throw error;
    }
  }
};

export default ConfigureRecordingSetPage;
