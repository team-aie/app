import log from 'electron-log';
import React, { FC, MouseEventHandler, useState } from 'react';

import { Consumer, RecordingSet } from '../../types';

import ConfigureRecordingSet from './configure-recording-set';
import './show-details.scss';
import Dvcfg from './dvcfg';
import ListPreview from './list-preview';
import OtoIni from './oto-ini';

export type RecordingPageState = 'home' | 'list-preview' | 'oto-ini' | 'dvcfg' | 'external';

const ConfigureRecordingSetPage: FC<{
  onNext: MouseEventHandler<HTMLElement>;
  onBack: MouseEventHandler<HTMLElement>;
  onSetSelected: Consumer<RecordingSet>;
}> = ({ onNext, onBack, onSetSelected }) => {
  const [recordingSetState, setRecordingSetState] = useState<RecordingPageState>('home');
  const [prevRecordingSetState, setPrevRecordingSetState] = useState<RecordingPageState>('external');

  switch (recordingSetState) {
    case 'home':
      return (
        <ConfigureRecordingSet
          onNext={onNext}
          onBack={onBack}
          onSetSelected={onSetSelected}
          setRecordingSetState={setRecordingSetState}
          setPrevRecordingSetState={setPrevRecordingSetState}
          prevState={prevRecordingSetState}
        />
      );
    case 'list-preview':
      return (
        <ListPreview
          setRecordingSetState={setRecordingSetState}
          prevState={prevRecordingSetState}
          setPrevRecordingSetState={setPrevRecordingSetState}
        />
      );
    case 'oto-ini':
      return (
        <OtoIni
          setRecordingSetState={setRecordingSetState}
          prevState={prevRecordingSetState}
          setPrevRecordingSetState={setPrevRecordingSetState}
        />
      );
    case 'dvcfg':
      return (
        <Dvcfg
          setRecordingSetState={setRecordingSetState}
          prevState={prevRecordingSetState}
          setPrevRecordingSetState={setPrevRecordingSetState}
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
