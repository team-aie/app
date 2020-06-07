declare module 'wavesurfer.js/dist/plugin/wavesurfer.spectrogram' {
  import { PluginDefinition } from 'wavesurfer.js';

  /**
   * @typedef {Object} SpectrogramPluginParams
   * @property {string|HTMLElement} container Selector of element or element in
   * which to render
   * @property {number} fftSamples=512 Number of samples to fetch to FFT. Must be
   * a power of 2.
   * @property {boolean} labels Set to true to display frequency labels.
   * @property {number} noverlap Size of the overlapping window. Must be <
   * fftSamples. Auto deduced from canvas size by default.
   * @property {string} windowFunc='hann' The window function to be used. One of
   * these: `'bartlett'`, `'bartlettHann'`, `'blackman'`, `'cosine'`, `'gauss'`,
   * `'hamming'`, `'hann'`, `'lanczoz'`, `'rectangular'`, `'triangular'`
   * @property {?number} alpha Some window functions have this extra value.
   * (Between 0 and 1)
   * @property {number} pixelRatio=wavesurfer.params.pixelRatio to control the
   * size of the spectrogram in relation with its canvas. 1 = Draw on the whole
   * canvas. 2 = Draw on a quarter (1/2 the length and 1/2 the width)
   * @property {?boolean} deferInit Set to true to manually call
   * `initPlugin('spectrogram')`
   * @property {?number[][]} colorMap A 256 long array of 4-element arrays.
   * Each entry should contain a float between 0 and 1 and specify
   * r, g, b, and alpha.
   */
  export interface SpectrogramPluginParams {
    container: string | HTMLElement;
    fftSamples?: number;
    labels: boolean;
    noverlap?: number;
    windowFunc?: string;
    alpha?: number;
    pixelRatio?: number;
    deferInit?: boolean;
    colorMap?: number[][];
  }

  export class SpectrogramPlugin {
    /**
     * Spectrogram plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * @param  {SpectrogramPluginParams} params Parameters used to initialise the plugin
     * @return {PluginDefinition} An object representing the plugin.
     */
    static create(params: SpectrogramPluginParams): PluginDefinition;
  }

  export default SpectrogramPlugin;
}
