import { ChromeHTMLAudioElement } from '../../types';

import audioDeviceConfigObservable from './audio-device-config-observable';
import audioInputStreamObservable from './audio-input-stream-observable';
import { ChromiumMediaService } from './chromium-media-service';

export default new ChromiumMediaService(
  new AudioContext({
    latencyHint: 0, // Request lowest latency possible
  }),
  new Audio() as ChromeHTMLAudioElement,
  audioDeviceConfigObservable,
  audioInputStreamObservable,
);
