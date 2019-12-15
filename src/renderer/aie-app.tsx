import React, { FunctionComponent, ReactElement } from 'react';
import { useLocalStorage } from 'react-use';
import { Grid } from 'semantic-ui-react';

import CreateProject from './components/create-project';
import LoadRecordingList from './components/load-recording-list';
import RecordingStudio from './components/recording-studio';
import { PageState, RecordingItem } from './types';
import { Locale } from './types/i18n';

const AieApp: FunctionComponent = () => {
  const [environment] = useLocalStorage('environment', {
    locale: Locale.ZH_CN,
  });
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
        return (
          <LoadRecordingList
            setPageState={setPageState}
            setRecordingList={setRecordingList}
            environment={environment}
          />
        );
    }
  };

  return (
    <div style={{ padding: '2vh' }}>
      <Grid>
        <Grid.Row>
          <Grid.Column>{routePageToComponent()}</Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <pre>
              {JSON.stringify(
                {
                  environment,
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
  );
};

export default AieApp;
