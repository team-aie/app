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
  private readonly gainNode: GainNode = this.audioCtx.createGain();
  private readonly destinationNode: MediaStreamAudioDestinationNode = this.audioCtx.createMediaStreamDestination();
  private currentSource?: AudioNode;
  private audioInputStream?: MediaStream;
  private recorder?: MediaRecorder;

  constructor(
    audioCtx: AudioContext,
    private readonly audioElement: ChromeHTMLAudioElement,
    private readonly audioDeviceConfigObservable: AudioDeviceConfigObservable,
    private readonly audioInputStreamObservable: AudioInputStreamObservable,
  ) {
    super(audioCtx);
    this.gainNode.connect(this.destinationNode);
    this.audioElement.autoplay = true;
    this.audioElement.srcObject = this.destinationNode.stream;
    this.audioDeviceConfigObservable.subscribe({
      next: this.onNextAudioDeviceConfig,
    });
    this.audioInputStreamObservable.subscribe({
      next: this.onNextAudioInputStream,
    });
  }

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

  setSource = (source: AudioNode): void => {
    this.removeCurrentSource();
    source.connect(this.gainNode);
    this.currentSource = source;
  };

  currentState = (): MediaServiceState => {
    return this.audioCtx.state;
  };

  resumePlaying = async (): Promise<void> => {
    if (this.currentState() === 'suspended') {
      return this.audioCtx.resume();
    }
  };

  suspendPlaying = async (): Promise<void> => {
    if (this.currentState() === 'running') {
      return this.audioCtx.suspend();
    }
  };

  stopPlaying = async (): Promise<void> => {
    if (this.currentState() === 'running') {
      await this.suspendPlaying();
      this.removeCurrentSource();
    }
  };

  close = async (): Promise<void> => {
    await stop();
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

  playAudioNode = async (node: AudioNode): Promise<void> => {
    this.setSource(node);
    return this.resumePlaying();
  };

  playBlob = async (blob: Blob): Promise<void> => {
    const sourceElement = new Audio();
    sourceElement.srcObject = blob;
    return this.playAudioNode(this.audioCtx.createMediaElementSource(sourceElement));
  };

  playAudioInput = async (): Promise<void> => {
    this.audioInputStreamObservable.switchOn();
    if (this.audioInputStream) {
      return this.playMediaStream(this.audioInputStream);
    }
    throw new Error('No audio input stream to play!');
  };

  playMediaStream = async (stream: MediaStream): Promise<void> => {
    return this.playAudioNode(this.audioCtx.createMediaStreamSource(stream));
  };
}
