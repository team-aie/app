import log from 'electron-log';
import React, { FC, MouseEventHandler, useState } from 'react';
import { useLocalStorage, usePrevious } from 'react-use';

import { Consumer, RecordingSet } from '../../types';
import { checkFileExistence, getLSKey, join, readFile } from '../../utils';

import { ConfigureRecordingSet } from './configure-recording-set';
import './show-details.scss';
import './index.scss';
import { PreviewPage } from './preview-page';

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

  const [otoText, setOtoText] = useState<string>('oto file not availible');
  const [recListText, setRecListText] = useState<string>('reclist file not availible');
  const [dvcfgText, setDvcfgText] = useState<string>('dvcfg file not availible');

  const [recordingSets = [], setRecordingSets] = useLocalStorage<RecordingSet[]>(
    getLSKey('ConfigureRecordingSetPage', 'recordingSets'),
    [],
  );

  const [selectedRecordingSetIndex = -1, setSelectedRecordingSetIndex] = useLocalStorage<number>(
    getLSKey('ConfigureRecordingSetPage', 'selectedRecordingSetIndex'),
    -1,
  );

  const rootPath = 'external\\z.cvvc_normal';
  const filePathOto = join(rootPath, 'oto.ini');
  (async (): Promise<'folder' | 'file' | false> => {
    return checkFileExistence(filePathOto);
  })().then((result) =>
    (async (): Promise<string> => {
      if (result == false) {
        return 'oto.ini file does not exist';
      }
      return await readFile(filePathOto);
    })().then((otoIniText) => {
      setOtoText(otoIniText);
    }),
  );

  const filePathList = join(rootPath, 'Reclist.txt');
  (async (): Promise<'folder' | 'file' | false> => {
    return checkFileExistence(filePathList);
  })().then((result) =>
    (async (): Promise<string> => {
      if (result == false) {
        return 'reclist file does not exist';
      }
      return await readFile(filePathList);
    })().then((recListText) => {
      setRecListText(recListText);
    }),
  );

  const filePathDvcfg = join(rootPath, 'voice.dvcfg');
  (async (): Promise<'folder' | 'file' | false> => {
    return checkFileExistence(filePathDvcfg);
  })().then((result) =>
    (async (): Promise<string> => {
      if (result == false) {
        return 'voice.dvcfg file does not exist';
      } else {
        return await readFile(filePathDvcfg);
      }
    })().then((dvcfgText) => {
      setDvcfgText(dvcfgText);
    }),
  );

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
          pageText={recListText}
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
          pageText={otoText}
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
          pageText={dvcfgText}
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
