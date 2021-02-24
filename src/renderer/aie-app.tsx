import log from 'electron-log';
import React, { FC, Fragment, ReactElement } from 'react';
import Col from 'react-bootstrap/Col';
import useLocalStorage from 'react-use/lib/useLocalStorage';

import ConfigureRecordingSetPage from './components/configure-recording-set-page';
import { Positional } from './components/helper-components';
import LicenseDisclosure from './components/license-disclosure';
import LocaleSelector from './components/locale-selector';
import OpenProjectPage from './components/open-project-page';
import { RecordingPage } from './components/recording-page';
import { SettingsPage } from './components/settings-page';
import StyleSwitcher from './components/style-switcher';
import WelcomePage from './components/welcome-page';
import { LocaleContext, RecordingProjectContext, ThemeContext } from './contexts';
import { PAGE_STATES_IN_ORDER } from './env-and-consts';
import recordingListDataService from './services/recording-list-data-service';
import { RecordingItem, RecordingProject, RecordingSet, ScaleKey, SupportedOctave, SupportedTheme } from './types';
import { getLSKey, join, useLocale } from './utils';

const { length: numStates } = PAGE_STATES_IN_ORDER;

const BottomRightDisplay: FC = () => (
  <Positional position={'bottom-right'}>
    <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
      <LocaleSelector fontSize={'75%'} />
    </Col>
    <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
      <LicenseDisclosure triggerStyle={{ fontSize: '75%' }} />
    </Col>
  </Positional>
);
// const TopRightDisplay: FC = () => (
//   <Positional position={'top-right'}>
//     <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
//       <StyleSwitcher triggerStyle={{ fontSize: '75%' }} />
//     </Col>
//   </Positional>
// );
const AieApp: FC = () => {
  const [locale, setLocale] = useLocale();
  const [theme = SupportedTheme.LIGHT, setTheme] = useLocalStorage(getLSKey('AieApp', 'theme'), SupportedTheme.LIGHT);
  const [pageStateIndex = 0, setPageStateIndex] = useLocalStorage(getLSKey('AieApp', 'pageStateIndex'), 0);
  const pageState = PAGE_STATES_IN_ORDER[pageStateIndex];
  function changePage(isNext: boolean): void {
    if (isNext) {
      setPageStateIndex((pageStateIndex + 1) % numStates);
    } else {
      setPageStateIndex((pageStateIndex - 1 + numStates) % numStates);
    }
  }

  // TODO: Will decide whether this is a good idea later
  // if (!isDevelopment) {
  //   // This is intentional for debugging purposes
  //   // eslint-disable-next-line react-hooks/rules-of-hooks
  //   useEffect(() => {
  //     const window = remote.getCurrentWindow();
  //     if (pageState === 'recording') {
  //       window.setMaximizable(true);
  //       window.setResizable(true);
  //     } else {
  //       window.setMaximizable(false);
  //       window.setResizable(false);
  //       window.setSize(800, 600);
  //     }
  //   }, [pageState]);
  // }

  const [recordingProject = { name: '', rootPath: '' }, setRecordingProject] = useLocalStorage<RecordingProject>(
    getLSKey('AieApp', 'recordingProject'),
    { name: '', rootPath: '' },
  );

  const [recordingList = [], setRecordingList] = useLocalStorage(
    getLSKey('AieApp', 'recordingList'),
    [] as RecordingItem[],
  );
  const [projectFolder = '', setProjectFolder] = useLocalStorage(getLSKey('AieApp', 'projectFolder'), '');
  const [recordingSet, setRecordingSet] = useLocalStorage<RecordingSet | undefined>(
    getLSKey('AieApp', 'recordingSet'),
    undefined,
  );
  const [[key = 'C', octave = 3] = [], setKeyOctave] = useLocalStorage<[ScaleKey, SupportedOctave]>(
    getLSKey('AieApp', 'keyOctave'),
    ['C', 3],
  );

  const adaptToPrototypeRecordingStudio = (recordingSet: RecordingSet): void => {
    if (recordingSet) {
      setRecordingSet(recordingSet);
      setProjectFolder(recordingProject.rootPath);
      const {
        scale: { key: newKey, octave: newOctave },
        recordingList,
      } = recordingSet;
      setKeyOctave([newKey, newOctave]);
      recordingListDataService.readData(recordingList).then(({ recordingItems }) => setRecordingList(recordingItems));
    }
  };

  const routePageToComponent = (): ReactElement => {
    const simpleOnNext = (): void => changePage(true);
    const simpleOnBack = (): void => changePage(false);
    const goToSettingsPage = (): void => setPageStateIndex(4);
    const goToConfigureRecordingSetPage = (): void => setPageStateIndex(2);

    switch (pageState) {
      case 'welcome':
        return <WelcomePage onNext={simpleOnNext} />;
      case 'open-project':
        return <OpenProjectPage onNext={simpleOnNext} onBack={simpleOnBack} />;
      case 'configure-recording-set':
        return (
          <ConfigureRecordingSetPage
            onSettingsButtonClick={goToSettingsPage}
            onNext={simpleOnNext}
            onBack={simpleOnBack}
            onSetSelected={adaptToPrototypeRecordingStudio}
          />
        );
      case 'settings':
        return <SettingsPage onSettingsButtonClick={goToConfigureRecordingSetPage} />;
      case 'recording':
        return (
          <RecordingPage
            onBack={simpleOnBack}
            recordingItems={recordingList}
            basePath={join(projectFolder, (recordingSet && recordingSet.name) || '')}
            scaleKey={key}
            octave={octave}
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
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <RecordingProjectContext.Provider value={{ recordingProject, setRecordingProject }}>
          <Fragment>
            <Positional position={'top-right'}>
              <StyleSwitcher />
            </Positional>
            {routePageToComponent()}
            {pageStateIndex === 0 && <BottomRightDisplay />}
          </Fragment>
        </RecordingProjectContext.Provider>
      </ThemeContext.Provider>
    </LocaleContext.Provider>
  );
};

export default AieApp;
