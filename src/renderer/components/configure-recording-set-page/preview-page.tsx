import React, { FC, useEffect, useState } from 'react';
import { Col, Row } from 'react-bootstrap';
import Container from 'react-bootstrap/esm/Container';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';
import ImageButton from '../image-button';

import downButton from './down-button.svg';
import leftButton from './left-button.svg';
import rightButton from './right-button.svg';

import { RecordingPageState } from '.';

interface PreviewPageProps {
  setRecordingSetState: Consumer<RecordingPageState>;
  leftPage: RecordingPageState;
  rightPage: RecordingPageState;
  pageName: string;
  transition: boolean;
  setTransition: Consumer<boolean>;
  pageText: string;
}

export const PreviewPage: FC<PreviewPageProps> = ({
  setRecordingSetState,
  leftPage,
  rightPage,
  pageName,
  transition,
  setTransition,
  pageText,
}) => {
  const [className, setClassName] = useState<string>('slide-down');

  const transitionProps = {
    in: transition,
    appear: true,
    timeout: 3000,
    classNames: className,
  };
  useEffect(() => {
    if (!transition) {
      setTransition(true);
    }
  });
  return (
    <div>
      <CSSTransition {...transitionProps}>
        <Container fluid={true}>
          <Col></Col>
          <Col>
            <Row className="d-flex justify-content-center">
              <ImageButton
                onClick={(): void => {
                  setRecordingSetState('home');
                }}
                src={downButton}
                width="2rem"
              />
            </Row>
            <Row>
              <Col sm="auto">
                {' '}
                <ImageButton
                  onClick={(): void => {
                    setRecordingSetState(leftPage);
                    setTransition(false);
                    setClassName('slide-left');
                  }}
                  src={leftButton}
                  width="1rem"
                />
              </Col>
              <Col>
                <Row>
                  <h1>{pageName}</h1>
                </Row>
                <Row>
                  <pre>{pageText}</pre>
                </Row>
              </Col>
              <Col sm="auto">
                <ImageButton
                  onClick={(): void => {
                    setRecordingSetState(rightPage);
                    setTransition(false);
                    setClassName('slide-right');
                  }}
                  src={rightButton}
                  width="1rem"
                />
              </Col>
            </Row>
          </Col>
          <Col></Col>
        </Container>
      </CSSTransition>
    </div>
  );
};
