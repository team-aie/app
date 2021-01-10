import log from 'electron-log';
import React, { FC, MouseEventHandler, useState } from 'react';
import { usePrevious } from 'react-use';

import { Consumer, RecordingSet } from '../../types';
import { join, readFile } from '../../utils';

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

  (async (): Promise<string> => {
    const rootPath = 'external\\z.cvvc_normal';
    const filePath = join(rootPath, 'oto.ini');

    return await readFile(filePath);
  })().then((otoIniText) => {
    setOtoText(otoIniText);
  });

  (async (): Promise<string> => {
    const rootPath = 'external\\z.cvvc_normal';
    const filePath = join(rootPath, 'Reclist.txt');

    return await readFile(filePath);
  })().then((listPreviewText) => {
    setRecListText(listPreviewText);
  });

  (async (): Promise<string> => {
    // const rootPath = 'external\\z.cvvc_normal';
    // const filePath = join(rootPath, 'Reclist.txt');
    return 'dvcfg file does not exist';

    // return await readFile(filePath);
  })().then((dvcfgText) => {
    setDvcfgText(dvcfgText);
  });

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
