import React, { FC, Fragment } from 'react';
import Col from 'react-bootstrap/Col';
import Image from 'react-bootstrap/Image';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';

import { ScaleKey, SupportedOctave } from '../../types';
import ImageButton from '../image-button';

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
          <ImageButton
            onClick={(): void => {
              toggleRecord();
            }}
            img={recordButton}
            passedWidth="6rem"></ImageButton>
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
            <ImageButton
              onClick={(): void => {
                togglePlay();
              }}
              img={playRecordedItem}
              passedWidth="3rem"></ImageButton>
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
        <ImageButton
          onClick={(): void => {
            togglePlayScale();
          }}
          img={playScale}
          passedWidth="2rem"></ImageButton>
      </Row>
    </Fragment>
  );
};
