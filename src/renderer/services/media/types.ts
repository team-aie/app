/**
 * Currently equals {@link AudioContextState}
 */
export type MediaServiceState = 'closed' | 'running' | 'suspended';

interface DelegatedAudioContextActions {
  createAnalyser(): AnalyserNode;
  createBiquadFilter(): BiquadFilterNode;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  createChannelMerger(numberOfInputs?: number): ChannelMergerNode;
  createChannelSplitter(numberOfOutputs?: number): ChannelSplitterNode;
  createConstantSource(): ConstantSourceNode;
  createConvolver(): ConvolverNode;
  createDelay(maxDelayTime?: number): DelayNode;
  createDynamicsCompressor(): DynamicsCompressorNode;
  createGain(): GainNode;
  createIIRFilter(feedforward: number[], feedback: number[]): IIRFilterNode;
  createOscillator(options?: OscillatorOptions): OscillatorNode;
  createPanner(): PannerNode;
  createPeriodicWave(
    real: number[] | Float32Array,
    imag: number[] | Float32Array,
    constraints?: PeriodicWaveConstraints,
  ): PeriodicWave;
  createScriptProcessor(
    bufferSize?: number,
    numberOfInputChannels?: number,
    numberOfOutputChannels?: number,
  ): ScriptProcessorNode;
  createStereoPanner(): StereoPannerNode;
  createWaveShaper(): WaveShaperNode;
}

export interface MediaService extends DelegatedAudioContextActions {
  getIsRecording(): boolean;
  startRecording(): Promise<Blob>;
  stopRecording(): void;
  currentState(): MediaServiceState;
  resumePlaying(): Promise<void>;
  suspendPlaying(): Promise<void>;
  stopPlaying(): Promise<void>;
  close(): Promise<void>;
  setVolume(volume: number): void;
  getVolume(): number;
  switchOnAudioInput(): void;
  audioBlobToWavArrayBuffer(audioBlob: Blob): Promise<ArrayBuffer>;
  playBlob(blob: Blob): Promise<void>;
  playAudioNode(node: AudioScheduledSourceNode | AudioNode): Promise<void>;
  playAudioInput(): Promise<void>;
  playMediaStream(stream: MediaStream): Promise<void>;
}
