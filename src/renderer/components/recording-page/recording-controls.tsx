import React, { FC, Fragment } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';

import { ScaleKey, SupportedOctave } from '../../types';
import ImageButton from '../image-button';
import { TextButton } from '../text-button';

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
          <ImageButton onClick={toggleRecord} src={recordButton} width="6rem" />
        </Col>
        <Col className={'d-flex flex-column justify-content-center'}>
          <Row>
            <TextButton onClick={goToPrevious}>{t('previous')}</TextButton>
          </Row>
          <Row>
            <ImageButton onClick={togglePlay} src={playRecordedItem} width="3rem" />
          </Row>
          <Row>
            <TextButton onClick={goToNext}>{t('next')}</TextButton>
          </Row>
        </Col>
      </Row>
      <Row className={'d-flex justify-content-center mt-3'}>
        {t('Scale')} - {scaleKey}
        {octave}
        <ImageButton onClick={togglePlayScale} src={playScale} width="2rem" />
      </Row>
    </Fragment>
  );
};
