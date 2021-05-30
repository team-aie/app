import mediaDeviceInfoService from '../media-device-info-service';

import { AudioDeviceConfigService } from './audio-device-config-service';

export * from './types';
export { AudioDeviceConfigService };
export default new AudioDeviceConfigService(mediaDeviceInfoService);
