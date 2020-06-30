import mediaDeviceInfoObservable from '../media-device-info-observable';

import { AudioDeviceConfigObservable } from './audio-device-config-observable';

export { AudioDeviceConfigObservable };
export default new AudioDeviceConfigObservable(mediaDeviceInfoObservable);
