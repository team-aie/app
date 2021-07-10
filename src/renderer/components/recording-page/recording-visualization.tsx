import log from 'electron-log';
import React, { FC, useEffect, useRef } from 'react';
import { Col, Row } from 'react-bootstrap';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import WaveSurfer from 'wavesurfer.js';
import MicrophonePlugin from 'wavesurfer.js/src/plugin/microphone';
import SpectrogramPlugin from 'wavesurfer.js/src/plugin/spectrogram';

import { noOp } from '../../../common/env-and-consts';
import { acquireAudioInputStream, checkFileExistence, join, readFile } from '../../utils';
import { FileMonitor } from '../../utils/file-monitor';
import { useInitializerRef } from '../../utils/use-initializer-ref';
import { useAudioInputOutputDevices } from '../settings-page/hooks';

import { State } from './types';

export interface RecordingVisualizationProps {
  /**
   * Last state the recording page was in {idle, recording}
   */
  prevState?: State;
  /**
   * Current state the recording page was in {idle, recording}
   */
  state: State;
  /**
   * File path of the current recording item's .wav file
   */
  filePath?: string;
  /**
   * File path to the folder of the current project, used for the {@link FileMonitor}
   */
  basePath: string;
  /**
   * Name of the current recording item, used to limit the filewatcher events
   */
  recordingItemName: string;
}

const GRAPH_WIDTH = '60%';

export const RecordingVisualization: FC<RecordingVisualizationProps> = ({
  prevState,
  state,
  filePath,
  basePath,
  recordingItemName,
}) => {
  const waveSurferRef = useRef<WaveSurfer>();
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const spectrogramContainerRef = useRef<HTMLDivElement>(null);
  const [, , audioInputDeviceId, , ,] = useAudioInputOutputDevices();
  const fileMonitorRef = useInitializerRef(() => new FileMonitor(basePath));

  /**
   * Check to see if the spectrogram plugin is active on the wavesurfer instance.
   * If the plugin is not active, add and create a new instance of the Spectrogram plugin.
   */
  const checkSpectrogramPluginOrCreateNew = async () => {
    const waveSurfer = waveSurferRef.current;
    const spectrogramContainer = waveformContainerRef.current;

    if (!waveSurfer) {
      return;
    }

    if (!spectrogramContainer) {
      return;
    }

    if (!('spectrogram' in waveSurfer.getActivePlugins())) {
      waveSurfer
        .addPlugin(
          SpectrogramPlugin.create({
            container: spectrogramContainer,
            labels: false,
          }),
        )
        .initPlugin('spectrogram');
    }
    return;
  };

  /**
   * Load a .wav file into the waveform instance.
   */
  const loadWavFile = (filePathToRead: string): (() => void) => {
    const waveSurfer = waveSurferRef.current;

    if (!waveSurfer) {
      return noOp();
    }
    let cancelled = false;

    (async (): Promise<void> => {
      if ((await checkFileExistence(filePathToRead)) === 'file') {
        const data = await readFile(filePathToRead, true);
        if (!cancelled) {
          waveSurfer.loadBlob(new Blob([new Uint8Array(data)]));
          log.info('Triggered waveform update');
        }
      }
    })();

    return (): void => {
      cancelled = true;
    };
  };

  /**
   * Respond appropriately to a File Event based on the type and the application state.
   */
  const respondToFileEvent = (fileEvent: [string, string]) => {
    const waveSurfer = waveSurferRef.current;

    if (!waveSurfer) {
      return noOp();
    }

    const fileEventType = fileEvent[0];
    const filePathFromEvent = fileEvent[1];

    if (filePathFromEvent.includes(recordingItemName)) {
      if (state === 'idle') {
        if (fileEventType === 'add') {
          checkSpectrogramPluginOrCreateNew();
          loadWavFile(filePathFromEvent);
        } else if (fileEventType === 'unlink') {
          // FIXME: Temporarily disable the alert until state interaction is fixed.
          // alert('File ' + filePathFromEvent + ' was deleted.');
          waveSurfer.empty();
          waveSurfer.destroyPlugin('spectrogram');
        }
      }
    }
    return;
  };

  useEffectOnce(() => {
    const waveSurfer = WaveSurfer.create({
      interact: false,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      container: waveformContainerRef.current!,
      height: 100,
      plugins: [
        SpectrogramPlugin.create({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          container: spectrogramContainerRef.current!,
          labels: false,
        }),
        MicrophonePlugin.create({}),
      ],
    });

    fileMonitorRef.current.watch(['add', 'unlink', 'change']);
    fileMonitorRef.current.getSubject().subscribe((x: [string, string]) => {
      respondToFileEvent(x);
    });

    waveSurferRef.current = waveSurfer;

    return (): void => {
      fileMonitorRef.current.closeAll();
      waveSurfer.destroy();
    };
  });

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;

    if (!waveSurfer) {
      return noOp();
    }

    checkSpectrogramPluginOrCreateNew();

    if (state !== 'recording') {
      waveSurfer.microphone.pause();
      const filePathToRead = filePath || join(__static, 'empty.wav');
      loadWavFile(filePathToRead);
    } else if (state === 'recording') {
      if (!waveSurfer.microphone.active) {
        acquireAudioInputStream(audioInputDeviceId === undefined ? '' : audioInputDeviceId, 44100, 16).then(
          (mediaStream: MediaStream) => waveSurfer.microphone.gotStream(mediaStream),
        );
      } else {
        waveSurfer.microphone.play();
      }
    }

    return noOp();
  }, [filePath, prevState, state, audioInputDeviceId]);

  return (
    <Col style={{ width: GRAPH_WIDTH, marginTop: 20, marginBottom: 20 }}>
      <Row>
        <div style={{ width: '100%', height: '100%' }} id={'waveform-container'} ref={waveformContainerRef} />
      </Row>
      <Row>
        <div style={{ width: '100%', height: '100%' }} id={'spectrogram-container'} ref={spectrogramContainerRef} />
      </Row>
    </Col>
  );
};
