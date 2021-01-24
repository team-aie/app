import log from 'electron-log';
import React, { FC, useEffect, useState } from 'react';
import { Col, Row } from 'react-bootstrap';
import Container from 'react-bootstrap/Container';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';
import { checkFileExistence, readFile } from '../../utils';
import ImageButton from '../image-button';

import downButton from './down-button.svg';
import switchPageButton from './switch-preview.svg';

import { RecordingPageState } from '.';

interface PreviewPageProps {
  setRecordingSetState: Consumer<RecordingPageState>;
  pageName: string;
  transition: boolean;
  setTransition: Consumer<boolean>;
  fileName: string;
  setDropDownState: () => void;
}

export const PreviewPage: FC<PreviewPageProps> = ({
  setRecordingSetState,
  pageName,
  transition,
  setTransition,
  fileName,
  setDropDownState,
}) => {
  const [className, setClassName] = useState<string>('slide-down');
  const [pageText, setPageText] = useState<string>(pageName + ' not availible');

  const transitionProps = {
    in: transition,
    appear: true,
    timeout: 3000,
    classNames: className,
  };
  useEffect(() => {
    let isSubscribed = true;
    if (!transition) {
      setTransition(true);
    }
    (async (): Promise<'folder' | 'file' | false> => {
      return checkFileExistence(fileName);
    })()
      .then((result) =>
        (async (): Promise<string> => {
          if (result != 'file') {
            return pageName + ' file does not exist';
          }
          if (isSubscribed) {
            return await readFile(fileName);
          } else {
            return 'page closed';
          }
        })()
          .then((fileText) => {
            if (isSubscribed) {
              setPageText(fileText);
            }
          })
          .catch((error) => {
            log.error(error);
            throw error;
          }),
      )
      .catch((error) => {
        log.error(error);
        throw error;
      });
    return () => {
      isSubscribed = false;
    };
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
              <Col>
                <Row>
                  <h1>{pageName}</h1>
                </Row>
                <Row
                  style={{
                    maxHeight: 'calc(100vh - 75px)',
                    overflowY: 'scroll',
                  }}>
                  <pre>{pageText}</pre>
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
          <Col></Col>
        </Container>
      </CSSTransition>
    </div>
  );
};
