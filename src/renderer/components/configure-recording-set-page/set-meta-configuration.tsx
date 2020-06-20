import React, { FC, Fragment } from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import { useTranslation } from 'react-i18next';

import { SCALE_KEYS_IN_ORDER, SUPPORTED_OCTAVES_IN_ORDER } from '../../env-and-consts';
import { Consumer, ScaleKey, SupportedOctave } from '../../types';
import { Select } from '../select';

interface SetMetaConfigurationProps {
  chosenKey: ScaleKey;
  setChosenKey: Consumer<ScaleKey>;
  chosenOctave: SupportedOctave;
  setChosenOctave: Consumer<SupportedOctave>;
  chosenName: string;
  setChosenName: Consumer<string>;
}

const SetMetaConfiguration: FC<SetMetaConfigurationProps> = ({
  chosenKey,
  setChosenKey,
  chosenOctave,
  setChosenOctave,
  chosenName,
  setChosenName,
}) => {
  const { t } = useTranslation();

  return (
    <Fragment>
      <Col xs={2} sm={2} md={2} lg={2} xl={2}>
        {t('Scale')}
      </Col>
      <Col xs={2} sm={2} md={2} lg={2} xl={2}>
        <Select value={chosenKey} onChange={(e): void => setChosenKey(e.target.value as ScaleKey)}>
          {SCALE_KEYS_IN_ORDER.map((scaleKey) => (
            <option value={scaleKey} key={scaleKey}>
              {scaleKey}
            </option>
          ))}
        </Select>
      </Col>
      <Col xs={2} sm={2} md={2} lg={2} xl={2}>
        <Select value={chosenOctave} onChange={(e): void => setChosenOctave(Number(e.target.value) as SupportedOctave)}>
          {SUPPORTED_OCTAVES_IN_ORDER.map((octave) => (
            <option value={octave} key={octave}>
              {octave}
            </option>
          ))}
        </Select>
      </Col>
      <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
        {t('Folder Name')}
      </Col>
      <Col>
        <Form.Control
          className={'border-top-0 border-right-0 border-bottom border-left-0 rounded-0'}
          value={chosenName}
          onChange={(e): void => setChosenName(e.target.value)}
        />
      </Col>
    </Fragment>
  );
};

export default SetMetaConfiguration;
