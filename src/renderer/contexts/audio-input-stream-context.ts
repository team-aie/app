import React from 'react';

import { Consumer } from '../types';

interface AudioInputStreamContextType {
  audioInputStream?: MediaStream;
  setAudioInputStream: Consumer<MediaStream>;
}

export const AudioInputStreamContext = React.createContext<AudioInputStreamContextType>({
  audioInputStream: undefined,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setAudioInputStream: (() => {}) as Consumer<MediaStream>,
});
