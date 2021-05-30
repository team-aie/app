import { MediaDeviceInfoService } from './media-device-info-service';

export * from './types';
export { MediaDeviceInfoService };
export default new MediaDeviceInfoService(navigator.mediaDevices);
