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
  prevState: RecordingPageState;
  leftPage: RecordingPageState;
  rightPage: RecordingPageState;
  pageName: string;
  transition: boolean;
  setTransition: Consumer<boolean>;
  // thisPage: RecordingPageState;
}

export const PreviewPage: FC<PreviewPageProps> = ({
  setRecordingSetState,
  prevState,
  leftPage,
  rightPage,
  pageName,
  transition,
  setTransition,
  // thisPage,
}) => {
  const getClassName: () => string = () => {
    return rightPage ? 'slide-left' : prevState == leftPage ? 'slide-right' : 'slide-down';
  };

  const [className, setClassName] = useState<string>(getClassName());

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

  console.log(transitionProps.classNames);
  return (
    <>
      <CSSTransition {...transitionProps}>
        <Container fluid={true}>
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
            <h1>{pageName}</h1>
          </Row>
          <Row>{'There will be a lot of text here at some point'}</Row>
          <Row>
            <Col className="d-flex justify-content-start">
              {' '}
              <ImageButton
                onClick={(): void => {
                  setRecordingSetState(leftPage);
                  setTransition(false);
                }}
                src={leftButton}
                width="2rem"
              />
            </Col>
            <Col className="d-flex justify-content-end">
              {' '}
              <ImageButton
                onClick={(): void => {
                  setRecordingSetState(rightPage);
                  setTransition(false);
                }}
                src={rightButton}
                width="2rem"
              />
            </Col>
          </Row>
        </Container>
      </CSSTransition>
    </>
  );
};
