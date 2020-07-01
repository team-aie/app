import { MediaService, MediaServiceState } from './types';

export abstract class BaseMediaService implements MediaService {
  protected constructor(protected audioCtx: AudioContext) {}

  createAnalyser = (): AnalyserNode => {
    return this.audioCtx.createAnalyser();
  };

  createBiquadFilter = (): BiquadFilterNode => {
    return this.audioCtx.createBiquadFilter();
  };

  createBuffer = (numberOfChannels: number, length: number, sampleRate: number): AudioBuffer => {
    return this.audioCtx.createBuffer(numberOfChannels, length, sampleRate);
  };

  createBufferSource = (): AudioBufferSourceNode => {
    return this.audioCtx.createBufferSource();
  };

  createChannelMerger = (numberOfInputs?: number): ChannelMergerNode => {
    return this.audioCtx.createChannelMerger(numberOfInputs);
  };

  createChannelSplitter = (numberOfOutputs?: number): ChannelSplitterNode => {
    return this.audioCtx.createChannelSplitter(numberOfOutputs);
  };

  createConstantSource = (): ConstantSourceNode => {
    return this.audioCtx.createConstantSource();
  };

  createConvolver = (): ConvolverNode => {
    return this.audioCtx.createConvolver();
  };

  createDelay = (maxDelayTime?: number): DelayNode => {
    return this.audioCtx.createDelay(maxDelayTime);
  };

  createDynamicsCompressor = (): DynamicsCompressorNode => {
    return this.audioCtx.createDynamicsCompressor();
  };

  createGain = (): GainNode => {
    return this.audioCtx.createGain();
  };

  createIIRFilter = (feedforward: number[], feedback: number[]): IIRFilterNode => {
    return this.audioCtx.createIIRFilter(feedforward, feedback);
  };

  createOscillator = (options?: OscillatorOptions): OscillatorNode => {
    return new OscillatorNode(this.audioCtx, options);
  };

  createPanner = (): PannerNode => {
    return this.audioCtx.createPanner();
  };

  createPeriodicWave = (
    real: number[] | Float32Array,
    imag: number[] | Float32Array,
    constraints?: PeriodicWaveConstraints,
  ): PeriodicWave => {
    return this.audioCtx.createPeriodicWave(real, imag, constraints);
  };

  createScriptProcessor = (
    bufferSize?: number,
    numberOfInputChannels?: number,
    numberOfOutputChannels?: number,
  ): ScriptProcessorNode => {
    return this.audioCtx.createScriptProcessor(bufferSize, numberOfInputChannels, numberOfOutputChannels);
  };

  createStereoPanner = (): StereoPannerNode => {
    return this.audioCtx.createStereoPanner();
  };

  createWaveShaper = (): WaveShaperNode => {
    return this.audioCtx.createWaveShaper();
  };

  abstract audioBlobToWavArrayBuffer(audioBlob: Blob): Promise<ArrayBuffer>;

  abstract close(): Promise<void>;

  abstract currentState(): MediaServiceState;

  abstract getIsRecording(): boolean;

  abstract getVolume(): number;

  abstract switchOnAudioInput(): void;

  abstract playAudioInput(): Promise<void>;

  abstract playAudioNode(node: AudioScheduledSourceNode | AudioNode): Promise<void>;

  abstract playBlob(blob: Blob): Promise<void>;

  abstract playMediaStream(stream: MediaStream): Promise<void>;

  abstract resumePlaying(): Promise<void>;

  abstract setVolume(volume: number): void;

  abstract startRecording(): Promise<Blob>;

  abstract stopPlaying(): Promise<void>;

  abstract stopRecording(): void;

  abstract suspendPlaying(): Promise<void>;
}
