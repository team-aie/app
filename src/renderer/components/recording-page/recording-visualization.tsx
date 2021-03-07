import log from 'electron-log';
import React, { FC, useEffect, useRef } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import useInterval from 'react-use/lib/useInterval';
import WaveSurfer from 'wavesurfer.js';
import SpectrogramPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.spectrogram';

import { noOp } from '../../env-and-consts';
import { checkFileExistence, join, readFile } from '../../utils';

import { State } from './types';

interface RecordingVisualizationProps {
  prevState?: State;
  state: State;
  filePath?: string;
}

const GRAPH_WIDTH = '60%';
const GRAPH_HEIGHT = 80;
const EMPTY_IMAGE_URL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export const RecordingVisualization: FC<RecordingVisualizationProps> = ({ prevState, state, filePath }) => {
  const waveSurferRef = useRef<WaveSurfer>();
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const waveformImageRef = useRef<HTMLImageElement>(null);
  const spectrogramContainerRef = useRef<HTMLDivElement>(null);
  const spectrogramImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const waveSurfer = WaveSurfer.create({
      interact: false,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      container: waveformContainerRef.current!,
      plugins: [
        SpectrogramPlugin.create({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          container: spectrogramContainerRef.current!,
          labels: true,
        }),
      ],
    });
    waveSurferRef.current = waveSurfer;

    return (): void => waveSurfer.destroy();
  }, []);

  // TODO Find a way to not use a loop to update
  useInterval(() => {
    const [waveformContainer, waveformImage, spectrogramContainer, spectrogramImage] = [
      waveformContainerRef.current,
      waveformImageRef.current,
      spectrogramContainerRef.current,
      spectrogramImageRef.current,
    ];

    if (waveformContainer && waveformImage && spectrogramContainer && spectrogramImage) {
      const waveformCanvases = waveformContainer.getElementsByTagName('canvas');
      if (waveformCanvases.length) {
        const waveform: HTMLCanvasElement = waveformCanvases[waveformCanvases.length - 1];
        waveformImage.src = waveform.toDataURL();
      }
      const spectrogramCanvases = spectrogramContainer.getElementsByTagName('canvas');
      if (spectrogramCanvases.length) {
        const spectrogram: HTMLCanvasElement = spectrogramCanvases[spectrogramCanvases.length - 1];
        spectrogramImage.src = spectrogram.toDataURL();
      }
    }
  }, 200);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer) {
      return noOp();
    }

    let cancelled = false;

    if (state !== 'recording') {
      const filePathToRead = filePath || join(__static, 'empty.wav');
      (async (): Promise<void> => {
        if ((await checkFileExistence(filePathToRead)) === 'file') {
          const data = await readFile(filePathToRead, true);
          if (!cancelled) {
            waveSurfer.loadBlob(new Blob([new Uint8Array(data)]));
            log.info('Triggered waveform update');
          }
        }
      })();
    }

    return (): void => {
      cancelled = true;
    };
  }, [filePath, prevState, state]);

  return (
    <Col>
      <Row style={{ marginBottom: 20 }}>
        <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'} />
        <Col style={{ width: GRAPH_WIDTH }}>
          <img
            alt={'Waveform of current audio file'}
            style={{ width: '100%', height: GRAPH_HEIGHT }}
            ref={waveformImageRef}
            src={EMPTY_IMAGE_URL}
          />
          <div
            style={{ width: '100%', height: GRAPH_HEIGHT, position: 'absolute', top: '100vh' }}
            id={'waveform-container'}
            ref={waveformContainerRef}
          />
        </Col>
        <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'} />
      </Row>
      <Row style={{ marginBottom: 20 }}>
        <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'} />
        <Col style={{ width: GRAPH_WIDTH }}>
          <img
            alt={'Spectrogram of current audio file'}
            style={{ width: '100%', height: GRAPH_HEIGHT }}
            ref={spectrogramImageRef}
            src={EMPTY_IMAGE_URL}
          />
          <div
            style={{ width: '100%', height: GRAPH_HEIGHT, position: 'absolute', top: '100vh' }}
            id={'spectrogram-container'}
            ref={spectrogramContainerRef}
          />
        </Col>
        <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'} />
      </Row>
    </Col>
  );
};
