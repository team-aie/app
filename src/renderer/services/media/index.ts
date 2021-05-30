import { ChromeHTMLAudioElement } from '../../types';

import audioDeviceConfigService from './audio-device-config-service';
import audioInputStreamService from './audio-input-stream-service';
import { ChromiumMediaService } from './chromium-media-service';

export default new ChromiumMediaService(
  new AudioContext({
    latencyHint: 0, // Request lowest latency possible
  }),
  new Audio() as ChromeHTMLAudioElement,
  audioDeviceConfigService,
  audioInputStreamService,
);
