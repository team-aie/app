import log from 'electron-log';
import React, { FC, MouseEventHandler, useState } from 'react';
import { usePrevious } from 'react-use';

import { Consumer, RecordingSet } from '../../types';

import { ConfigureRecordingSet } from './configure-recording-set';
import './show-details.scss';
import { Dvcfg } from './dvcfg';
import { ListPreview } from './list-preview';
import { OtoIni } from './oto-ini';
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
  const prevStateWithUndefine = usePrevious(recordingSetState);
  const prevState: RecordingPageState = prevStateWithUndefine != undefined ? prevStateWithUndefine : 'home';

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
      return <ListPreview setRecordingSetState={setRecordingSetState} prevState={prevState} />;
    case 'oto-ini':
      return <OtoIni setRecordingSetState={setRecordingSetState} prevState={prevState} />;
    case 'dvcfg':
      return <Dvcfg setRecordingSetState={setRecordingSetState} prevState={prevState} />;
    default: {
      const error = new Error(`Unknown pageState: ${recordingSetState}`);
      log.error(error);
      throw error;
    }
  }
};

export default ConfigureRecordingSetPage;
