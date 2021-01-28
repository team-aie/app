import log from 'electron-log';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { Col, Row } from 'react-bootstrap';
import Container from 'react-bootstrap/Container';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';
import { checkFileExistence, readFile } from '../../utils';
import ImageButton from '../image-button';

import downButton from './down-button.svg';
import switchPageButton from './switch-preview.svg';

import { RecordingPageState } from '.';

/*
setRecordingSetState: Sets the local pagestate (controls which subpage is displayed)
transition: boolean to determin whether the animated page in transition has occured
setTransition: sets transition
fileName: the name of the metadata file to populate the page with data from
setDropDownState: sets the built in reclist option
*/

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

    const findFile = async () => {
      const fileExistsResponse = checkFileExistence(fileName);
      const fileExistsAnswer = await fileExistsResponse;
      if (fileExistsAnswer) {
        if (!isSubscribed) {
          return;
        }
        if (fileExistsAnswer != 'file') {
          setPageText(pageName + ' file does not exist');
        }

        const fileContentsResponse = readFile(fileName);
        const fileContents = await fileContentsResponse;
        if (isSubscribed) {
          setPageText(fileContents);
        }
      }
    };
    findFile().catch((error) => {
      log.error(error);
      throw error;
    });

    if (!transition) {
      setTransition(true);
    }

    return () => {
      isSubscribed = false;
    };
  });

  const useFileInformation = () => {
    useEffect(() => {
      let isSubscribed = true;

      const findFile = async () => {
        const fileExistsResponse = checkFileExistence(fileName);
        const fileExistsAnswer = await fileExistsResponse;
        if (fileExistsAnswer) {
          if (!isSubscribed) {
            return;
          }
          if (fileExistsAnswer != 'file') {
            setPageText(pageName + ' file does not exist');
          }

          const fileContentsResponse = readFile(fileName);
          const fileContents = await fileContentsResponse;
          if (isSubscribed) {
            setPageText(fileContents);
          }
        }
      };
      findFile().catch((error) => {
        log.error(error);
        throw error;
      });
      return () => {
        isSubscribed = false;
      };
    });
  };

  const useTransition = () => {
    useEffect(() => {
      if (!transition) {
        setTransition(true);
      }
    });
  };

  useFileInformation();
  useTransition();

  return (
    <Fragment>
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
    </Fragment>
  );
};
