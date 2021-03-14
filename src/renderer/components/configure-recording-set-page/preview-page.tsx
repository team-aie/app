import React, { FC, Fragment, useEffect, useState } from 'react';
import { Col, Row } from 'react-bootstrap';
import Container from 'react-bootstrap/Container';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';
import ImageButton from '../image-button';

import downButton from './down-button.svg';
import switchPageButton from './switch-preview.svg';
import { RecordingPageState } from './types';

import './preview-page.scss';

interface PreviewPageProps {
  /**
   * Sets the local {@link RecordingPageState} (controls which subpage is displayed).
   */
  setRecordingSetState: Consumer<RecordingPageState>;
  /**
   * Name to be displayed at the top of the page.
   */
  pageName: string;
  /**
   * Whether the animated page in transition has occurred.
   */
  transition: boolean;
  /**
   * Sets whether the UI is in transition.
   */
  setTransition: Consumer<boolean>;
  /**
   * Content to be previewed in the body of the page.
   */
  previewContent: string;
  /**
   * Sets the built in recording list option.
   */
  setDropDownState: () => void;
}

export const PreviewPage: FC<PreviewPageProps> = ({
  setRecordingSetState,
  pageName,
  transition,
  setTransition,
  previewContent,
  setDropDownState,
}) => {
  const [className, setClassName] = useState<string>('slide-down');

  const transitionProps = {
    in: transition,
    appear: true,
    timeout: 3000,
    classNames: className,
  };

  const useTransition = () => {
    useEffect(() => {
      if (!transition) {
        setTransition(true);
      }
    });
  };

  useTransition();

  return (
    <Fragment>
      <CSSTransition {...transitionProps}>
        <Container fluid={true}>
          <Col />
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
              <Col>
                <Row>
                  <h1>{pageName}</h1>
                </Row>
                <Row
                  style={{
                    maxHeight: 'calc(100vh - 75px)',
                    overflowY: 'scroll',
                  }}>
                  <pre>{previewContent}</pre>
                </Row>
              </Col>
              <Col sm="auto" className="d-flex justify-content-center">
                <ImageButton
                  onClick={(): void => {
                    setDropDownState();
                    setTransition(false);
                    setClassName('slide-right');
                  }}
                  src={switchPageButton}
                  width="2rem"
                />
              </Col>
            </Row>
          </Col>
          <Col />
        </Container>
      </CSSTransition>
    </Fragment>
  );
};
