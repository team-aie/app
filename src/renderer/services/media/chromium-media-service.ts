import toWav from 'audiobuffer-to-wav';
import log from 'electron-log';

import { ChromeHTMLAudioElement, Closeable } from '../../types';

import { AudioDeviceConfigObservable } from './audio-device-config-observable';
import { AudioDeviceConfig } from './audio-device-config-observable/types';
import { AudioInputStreamObservable } from './audio-input-stream-observable';
import { BaseMediaService } from './base-media-service';
import { MediaServiceState } from './types';

/**
 * 1. Provides audio data playing capabilities
 * 2. Provides audio file playing capabilities
 * 3. Provides audio data/file conversion (media-utils)
 * 4. Provides audio input recording capabilities
 * 5. Allow configurations
 */
export class ChromiumMediaService extends BaseMediaService implements Closeable {
  private gainNode: GainNode = this.audioCtx.createGain();
  private destinationNode: MediaStreamAudioDestinationNode = this.audioCtx.createMediaStreamDestination();
  private currentSource?: AudioScheduledSourceNode | AudioNode;
  private audioInputStream?: MediaStream;
  private recorder?: MediaRecorder;

  constructor(
    audioCtx: AudioContext,
    private readonly audioElement: ChromeHTMLAudioElement,
    private readonly audioDeviceConfigObservable: AudioDeviceConfigObservable,
    private readonly audioInputStreamObservable: AudioInputStreamObservable,
  ) {
    super(audioCtx);
    this.audioElement.autoplay = true;
    this.createNewAudioGraph();
    this.audioDeviceConfigObservable.subscribe({
      next: this.onNextAudioDeviceConfig,
    });
    this.audioInputStreamObservable.subscribe({
      next: this.onNextAudioInputStream,
    });
  }

  /**
   * TODO Remove this after Chromium fixes the pitch-related bug when reusing the AudioContext.
   */
  createNewAudioGraph = (): void => {
    const volume = this.getVolume();
    this.audioCtx.close().catch(log.error);
    this.audioCtx = new AudioContext();
    this.gainNode = this.audioCtx.createGain();
    this.setVolume(volume);
    this.destinationNode = this.audioCtx.createMediaStreamDestination();
    this.gainNode.connect(this.destinationNode);
    this.audioElement.srcObject = this.destinationNode.stream;
  };

  private onNextAudioDeviceConfig = (audioDeviceConfig: AudioDeviceConfig): void => {
    if (audioDeviceConfig.audioOutputDeviceId) {
      this.audioElement.setSinkId(audioDeviceConfig.audioOutputDeviceId).catch(log.error);
    }
  };

  private onNextAudioInputStream = (audioInputStream: MediaStream | undefined): void => {
    if (this.getIsRecording()) {
      this.stopRecording();
    }
    this.audioInputStream = audioInputStream;
  };

  getIsRecording = (): boolean => {
    return !!this.recorder;
  };

  startRecording = async (): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      if (!this.getIsRecording()) {
        if (!this.audioInputStreamObservable.getIsOn()) {
          reject(new Error('Audio input is not turned on!'));
          return;
        }

        if (!this.audioInputStream) {
          reject(new Error('No audio input is specified or failed to create input stream!'));
          return;
        }

        const recorder = (this.recorder = new MediaRecorder(this.audioInputStream));
        const recordedChunks: Blob[] = [];

        recorder.ondataavailable = (e): void => {
          log.debug('New recorded data available');
          recordedChunks.push(e.data);
        };

        recorder.onstop = (): void => {
          if (!recordedChunks.length) {
            log.warn('No data recorded');
          }
          recorder.ondataavailable = null;
          recorder.onstop = null;
          recorder.onerror = null;
          resolve(new Blob(recordedChunks));
        };

        recorder.onerror = reject;

        recorder.start();
      }
    });
  };

  stopRecording = (): void => {
    if (this.recorder) {
      this.recorder.stop();
    }
    this.recorder = undefined;
  };

  private removeCurrentSource = (): void => {
    if (this.currentSource) {
      this.currentSource.disconnect();
    }
    this.currentSource = undefined;
  };

  private setSource = (source: AudioScheduledSourceNode | AudioNode): void => {
    source.connect(this.gainNode);
    this.currentSource = source;
  };

  currentState = (): MediaServiceState => {
    if (this.audioCtx.state === 'closed') {
      return 'closed';
    } else if (!this.currentSource) {
      return 'suspended';
    } else {
      return 'running';
    }
  };

  resumePlaying = async (): Promise<void> => {
    this.audioElement.muted = false;
    // FIXME Not sure if this works well
    // if (this.currentState() === 'suspended') {
    //   return this.audioCtx.resume();
    // }
  };

  suspendPlaying = async (): Promise<void> => {
    this.audioElement.muted = true;
    // FIXME Not sure if this works well
    // if (this.currentState() === 'running') {
    //   return this.audioCtx.suspend();
    // }
  };

  stopPlaying = async (): Promise<void> => {
    if (this.currentState() === 'running') {
      if (this.currentSource && 'stop' in this.currentSource) {
        this.currentSource.stop();
        if (this.currentSource.onended) {
          // Because this is set by startPlaying();
          (this.currentSource.onended as () => void)();
        }
      }
      await this.suspendPlaying();
      this.removeCurrentSource();
    }
  };

  close = async (): Promise<void> => {
    await this.stopPlaying();
    return this.audioCtx.close();
  };

  setVolume = (volume: number): void => {
    this.gainNode.gain.value = volume;
  };

  getVolume = (): number => {
    return this.gainNode.gain.value;
  };

  switchOnAudioInput = (): void => {
    this.audioInputStreamObservable.switchOn();
  };

  audioBlobToWavArrayBuffer = async (audioBlob: Blob): Promise<ArrayBuffer> => {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        const { result } = reader;
        if (result === null) {
          reject(new Error('Nothing recorded!'));
          return;
        }
        if (typeof result === 'string') {
          reject(new Error(`Result happens to be string: ${result}`));
          return;
        }
        this.audioCtx
          .decodeAudioData(result)
          .then((audioBuffer) => toWav(audioBuffer))
          .then(resolve);
      };
      reader.readAsArrayBuffer(audioBlob);
    });
  };

  playAudioNode = async (node: AudioScheduledSourceNode | AudioNode): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        this.setSource(node);
        const resumePlayingPromise = this.resumePlaying();
        if ('start' in node) {
          node.start();
          node.onended = (): void => {
            node.onended = null;
            resolve();
          };
          resumePlayingPromise.catch(reject);
        } else {
          resumePlayingPromise.then(resolve).catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  };

  playBlob = async (blob: Blob): Promise<void> => {
    const buffer = await this.audioBlobToWavArrayBuffer(blob);
    const audioBuffer = await this.audioCtx.decodeAudioData(buffer);
    this.createNewAudioGraph();
    const bufferSource = this.audioCtx.createBufferSource();
    bufferSource.buffer = audioBuffer;

    return this.playAudioNode(bufferSource);
  };

  playAudioInput = async (): Promise<void> => {
    this.audioInputStreamObservable.switchOn();
    if (this.audioInputStream) {
      this.createNewAudioGraph();
      return this.playMediaStream(this.audioInputStream);
    }
    throw new Error('No audio input stream to play!');
  };

  playMediaStream = async (stream: MediaStream): Promise<void> => {
    return this.playAudioNode(this.audioCtx.createMediaStreamSource(stream));
  };
}
