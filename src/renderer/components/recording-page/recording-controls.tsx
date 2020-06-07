import React, { FC, Fragment } from 'react';
import Col from 'react-bootstrap/Col';
import Image from 'react-bootstrap/Image';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';

import { ScaleKey, SupportedOctave } from '../../types';

import playRecordedItem from './play-recorded-item.svg';
import playScale from './play-scale.svg';
import recordButton from './record-button.svg';

interface RecordingControlsProps {
  toggleRecord: () => void;
  togglePlay: () => void;
  togglePlayScale: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  scaleKey: ScaleKey;
  octave: SupportedOctave;
}

export const RecordingControls: FC<RecordingControlsProps> = ({
  toggleRecord,
  togglePlay,
  togglePlayScale,
  goToPrevious,
  goToNext,
  scaleKey,
  octave,
}) => {
  const { t } = useTranslation();
  return (
    <Fragment>
      <Row>
        <Col />
        <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
          <Image
            src={recordButton}
            onClick={(): void => {
              toggleRecord();
            }}
            style={{ width: '6rem' }}
          />
        </Col>
        <Col className={'d-flex flex-column justify-content-center'}>
          <Row>
            <span
              onClick={(): void => {
                goToPrevious();
              }}>
              {t('previous')}
            </span>
          </Row>
          <Row>
            <Image
              src={playRecordedItem}
              className={'mt-2 mb-2'}
              onClick={(): void => {
                togglePlay();
              }}
            />
          </Row>
          <Row>
            <span
              onClick={(): void => {
                goToNext();
              }}>
              {t('next')}
            </span>
          </Row>
        </Col>
      </Row>
      <Row className={'d-flex justify-content-center mt-3'}>
        {t('Scale')} - {scaleKey}
        {octave}
        <Image
          src={playScale}
          className={'ml-2'}
          onClick={(): void => {
            togglePlayScale();
          }}
        />
      </Row>
    </Fragment>
  );
};
