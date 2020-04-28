import React, { FC, ReactElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from 'react-use';
import { Grid } from 'semantic-ui-react';

import CreateProject from './components/create-project';
import LoadRecordingList from './components/load-recording-list';
import LocaleSelector from './components/locale-selector';
import RecordingStudio from './components/recording-studio';
import ThemedRoot from './components/themed/themed-root';
import { LocaleContext } from './contexts';
import { PageState, RecordingItem, SupportedLocale } from './types';

const AieApp: FC = () => {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState(i18n.language as SupportedLocale);
  {
    useEffect(() => {
      document.documentElement.lang = locale.substr(0, 2).toLocaleLowerCase();
      document.documentElement.dir = i18n.dir(locale);

      if (locale !== i18n.language) {
        i18n.changeLanguage(locale);
      }
    }, [locale, i18n]);

    useEffect(() => {
      i18n.on('languageChanged', (lng) => {
        setLocale(lng as SupportedLocale);
      });
    }, [i18n]);
  }

  const [pageState, setPageState] = useLocalStorage('pageState', 'start' as PageState);
  const [recordingList, setRecordingList] = useLocalStorage('recordingList', [] as RecordingItem[]);
  const [projectFolder, setProjectFolder] = useLocalStorage('projectFolder', '');
  const [scales, setScales] = useLocalStorage('scales', [] as string[]);

  const routePageToComponent = (): ReactElement => {
    switch (pageState) {
      case 'create-project':
        return (
          <CreateProject
            setPageState={setPageState}
            projectFolder={projectFolder}
            setProjectFolder={setProjectFolder}
            scales={scales}
            setScales={setScales}
          />
        );
      case 'recording-studio':
        return (
          <RecordingStudio
            recordingList={recordingList}
            projectFolder={projectFolder}
            scales={scales}
            setPageState={setPageState}
          />
        );
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore Intended to fall through
      default:
        alert(`Unknown pageState: ${pageState}`);
      // eslint-disable-next-line no-fallthrough
      case 'start':
        return <LoadRecordingList setPageState={setPageState} setRecordingList={setRecordingList} />;
    }
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <ThemedRoot>
        <div style={{ padding: '2vh' }}>
          <Grid>
            <Grid.Row>
              <Grid.Column width={12} />
              <Grid.Column width={4}>
                <LocaleSelector />
              </Grid.Column>
            </Grid.Row>
            <Grid.Row>
              <Grid.Column>{routePageToComponent()}</Grid.Column>
            </Grid.Row>
            <Grid.Row>
              <Grid.Column>
                <pre>
                  {JSON.stringify(
                    {
                      locale,
                      pageState,
                      recordingList,
                      projectFolder,
                      scales,
                    },
                    null,
                    2,
                  )}
                </pre>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </div>
      </ThemedRoot>
    </LocaleContext.Provider>
  );
};

export default AieApp;
