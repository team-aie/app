declare module 'wavesurfer.js/dist/plugin/wavesurfer.microphone' {
  import { PluginDefinition } from 'wavesurfer.js';

  /**
   * @typedef {Object} MicrophonePluginParams
   * @property {MediaStreamConstraints} constraints The constraints parameter is a
   * MediaStreamConstaints object with two members: video and audio, describing
   * the media types requested. Either or both must be specified.
   * @property {number} bufferSize=4096 The buffer size in units of sample-frames.
   * If specified, the bufferSize must be one of the following values: `256`,
   * `512`, `1024`, `2048`, `4096`, `8192`, `16384`
   * @property {number} numberOfInputChannels=1 Integer specifying the number of
   * channels for this node's input. Values of up to 32 are supported.
   * @property {number} numberOfOutputChannels=1 Integer specifying the number of
   * channels for this node's output.
   * @property {?boolean} deferInit Set to true to manually call
   * `initPlugin('microphone')`
   */
  export interface MicrophonePluginParams {
    constraints?: MediaStreamConstraints;
    bufferSize?: number;
    numberOfInputChannels?: number;
    numberOfOutputChannels?: number;
    deferInit?: boolean;
  }

  export class MicrophonePlugin {
    /**
     * Microphone plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * @param  {MicrophonePluginParams} params Parameters used to initialise the plugin
     * @return {PluginDefinition} An object representing the plugin.
     */
    static create(params: MicrophonePluginParams): PluginDefinition;
  }

  export default MicrophonePlugin;
}
