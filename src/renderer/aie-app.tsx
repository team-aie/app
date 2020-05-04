import { remote } from 'electron';
import * as log from 'electron-log';
import React, { FC, Fragment, ReactElement, useEffect, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import { useTranslation } from 'react-i18next';
import useLocalStorage from 'react-use/lib/useLocalStorage';

import ConfigureRecordingSetPage from './components/configure-recording-set-page';
import LicenseDisclosure from './components/license-disclosure';
import LocaleSelector from './components/locale-selector';
import OpenProjectPage from './components/open-project-page';
import RecordingStudio from './components/recording-studio';
import StyleSwitcher from './components/style-switcher';
import WelcomePage from './components/welcome-page';
import { LocaleContext, RecordingProjectContext } from './contexts';
import { PAGE_STATES_IN_ORDER, isDevelopment } from './env-and-consts';
import { RecordingItem, RecordingProject, RecordingSet, SupportedLocale } from './types';
import { getLSKey, lineByLineParser, readFile } from './utils';
const { length: numStates } = PAGE_STATES_IN_ORDER;

const BottomRightDisplay: FC = () => (
  <Container className={'d-flex justify-content-end position-absolute'} style={{ bottom: '15px', right: '10px' }} fluid>
    <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
      <LocaleSelector fontSize={'75%'} />
    </Col>
    <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
      <LicenseDisclosure triggerStyle={{ fontSize: '75%' }} />
    </Col>
  </Container>
);

const AieApp: FC = () => {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState(i18n.language as SupportedLocale);
  {
    useEffect(() => {
      document.documentElement.lang = locale.substr(0, 2).toLocaleLowerCase();
      document.documentElement.dir = i18n.dir(locale);

      if (locale !== i18n.language) {
        i18n.changeLanguage(locale).catch(log.error);
      }
    }, [locale, i18n]);

    useEffect(() => {
      const updateLocaleHandler = (lng: SupportedLocale): void => {
        setLocale(lng);
      };
      i18n.on('languageChanged', updateLocaleHandler);

      return (): void => i18n.off('languageChanged', updateLocaleHandler);
    }, [i18n]);
  }

  const [pageStateIndex, setPageStateIndex] = useLocalStorage(getLSKey('AieApp', 'pageStateIndex'), 0);
  const pageState = PAGE_STATES_IN_ORDER[pageStateIndex];
  function changePage(isNext: boolean): void {
    if (isNext) {
      setPageStateIndex((pageStateIndex + 1) % numStates);
    } else {
      setPageStateIndex((pageStateIndex - 1 + numStates) % numStates);
    }
  }

  if (!isDevelopment) {
    // This is intentional for debugging purposes
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const window = remote.getCurrentWindow();
      if (pageState === 'recording-studio') {
        window.setMaximizable(true);
        window.setResizable(true);
      } else {
        window.setMaximizable(false);
        window.setResizable(false);
        window.setSize(800, 600);
      }
    }, [pageState]);
  }

  const [recordingProject, setRecordingProject] = useLocalStorage<RecordingProject>(
    getLSKey('AieApp', 'recordingProject'),
  );

  const [recordingList, setRecordingList] = useLocalStorage(getLSKey('AieApp', 'recordingList'), [] as RecordingItem[]);
  const [projectFolder, setProjectFolder] = useLocalStorage(getLSKey('AieApp', 'projectFolder'), '');
  const [scales, setScales] = useLocalStorage(getLSKey('AieApp', 'scales'), [] as string[]);

  const adaptToPrototypeRecordingStudio = (recordingSet: RecordingSet): void => {
    if (recordingSet) {
      setProjectFolder(recordingProject.rootPath);
      const {
        scale: { key, octave },
        recordingList,
      } = recordingSet;
      setScales([`${key}${octave}`]);
      if (recordingList.type === 'built-in') {
        lineByLineParser.parse(recordingList.name).then(setRecordingList);
      } else {
        readFile(recordingList.filePath).then(lineByLineParser.parse).then(setRecordingList);
      }
    }
  };

  const routePageToComponent = (): ReactElement => {
    const simpleOnNext = (): void => changePage(true);
    const simpleOnBack = (): void => changePage(false);

    switch (pageState) {
      case 'welcome':
        return <WelcomePage onNext={simpleOnNext} />;
      case 'open-project':
        return <OpenProjectPage onNext={simpleOnNext} onBack={simpleOnBack} />;
      case 'configure-recording-set':
        return (
          <ConfigureRecordingSetPage
            onNext={simpleOnNext}
            onBack={simpleOnBack}
            onSetSelected={adaptToPrototypeRecordingStudio}
          />
        );
      case 'recording-studio':
        return (
          <RecordingStudio
            recordingList={recordingList}
            projectFolder={projectFolder}
            scales={scales}
            setPageState={(): void => changePage(false)}
          />
        );
      default: {
        const error = new Error(`Unknown pageState: ${pageState}`);
        log.error(error);
        throw error;
      }
    }
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <RecordingProjectContext.Provider value={{ recordingProject, setRecordingProject }}>
        <Fragment>
          <StyleSwitcher />
          {routePageToComponent()}
          {pageStateIndex === 0 && <BottomRightDisplay />}
        </Fragment>
      </RecordingProjectContext.Provider>
    </LocaleContext.Provider>
  );
};

export default AieApp;
