import React from 'react';

import { noOp } from '../env-and-consts';
import { Consumer } from '../types';

interface AudioInputStreamContextType {
  audioInputStream?: MediaStream;
  setAudioInputStream: Consumer<MediaStream>;
}

export const AudioInputStreamContext = React.createContext<AudioInputStreamContextType>({
  audioInputStream: undefined,
  setAudioInputStream: noOp() as Consumer<MediaStream>,
});
