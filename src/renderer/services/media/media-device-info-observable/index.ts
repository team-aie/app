import { MediaDeviceInfoObservable } from './media-device-info-observable';

export { MediaDeviceInfoObservable };
export default new MediaDeviceInfoObservable(navigator.mediaDevices);
