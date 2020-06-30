import audioDeviceConfigObservable from '../audio-device-config-observable';

import { AudioInputStreamObservable } from './audio-input-stream-observable';

export { AudioInputStreamObservable };
export default new AudioInputStreamObservable(audioDeviceConfigObservable);
