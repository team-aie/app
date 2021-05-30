import audioDeviceConfigService from '../audio-device-config-service';

import { AudioInputStreamService } from './audio-input-stream-service';

export { AudioInputStreamService };
export default new AudioInputStreamService(audioDeviceConfigService);
