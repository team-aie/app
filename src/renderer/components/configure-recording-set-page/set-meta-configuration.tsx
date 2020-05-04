import React, { FC, Fragment } from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';

import { SCALE_KEYS_IN_ORDER, SUPPORTED_OCTAVES_IN_ORDER } from '../../env-and-consts';
import { Consumer, ScaleKey, SupportedOctave } from '../../types';

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
  return (
    <Fragment>
      <Col xs={2} sm={2} md={2} lg={2} xl={2}>
        Scale
      </Col>
      <Col xs={2} sm={2} md={2} lg={2} xl={2}>
        <Form>
          <Form.Group>
            <Form.Control
              as={'select'}
              className={'border-top-0 border-right-0 border-bottom border-left-0 rounded-0'}
              value={chosenKey}
              onChange={(e): void => setChosenKey(e.target.value as ScaleKey)}>
              {SCALE_KEYS_IN_ORDER.map((scaleKey) => (
                <option value={scaleKey} key={scaleKey}>
                  {scaleKey}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        </Form>
      </Col>
      <Col xs={2} sm={2} md={2} lg={2} xl={2}>
        <Form>
          <Form.Group>
            <Form.Control
              as={'select'}
              className={'border-top-0 border-right-0 border-bottom border-left-0 rounded-0'}
              value={chosenOctave}
              onChange={(e): void => setChosenOctave(Number(e.target.value) as SupportedOctave)}>
              {SUPPORTED_OCTAVES_IN_ORDER.map((octave) => (
                <option value={octave} key={octave}>
                  {octave}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        </Form>
      </Col>
      <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
        Folder Name
      </Col>
      <Col>
        <FormControl
          className={'border-top-0 border-right-0 border-bottom border-left-0 rounded-0'}
          value={chosenName}
          onChange={(e): void => setChosenName(e.target.value)}
        />
      </Col>
    </Fragment>
  );
};

export default SetMetaConfiguration;
