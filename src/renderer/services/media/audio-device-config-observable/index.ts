import mediaDeviceInfoService from '../media-device-info-service';

import { AudioDeviceConfigObservable } from './audio-device-config-observable';

export { AudioDeviceConfigObservable };
export default new AudioDeviceConfigObservable(mediaDeviceInfoService);
