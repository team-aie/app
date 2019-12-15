import * as fs from 'fs';

import React, { ChangeEventHandler, MouseEventHandler, ReactElement, useState } from 'react';
import { Button, Form, Grid, Header, Label } from 'semantic-ui-react';

import { i18n } from '../../services/i18n';
import { Consumer, Environment, PageState, RecordingItem } from '../../types';
import { Locale } from '../../types/i18n';
import I18nText from '../i18n-text';

import lineByLineParser from './line-by-line-parser';

interface LoadRecordingListProps {
  setPageState: Consumer<PageState>;
  setRecordingList: Consumer<RecordingItem[]>;
  environment: Environment;
}

const LoadRecordingList = ({ setPageState, setRecordingList, environment }: LoadRecordingListProps): ReactElement => {
  const { locale } = environment;
  const [recordingListFilePath, setRecordingListFilePath] = useState(null as null | string);

  const onRecordingListFileSelected: ChangeEventHandler<HTMLInputElement> = (e): void => {
    if (!e.target.files) {
      // TODO: Is this possible?
      return;
    }

    setRecordingListFilePath(e.target.files[0].path);
  };

  const readRecordingListFile: MouseEventHandler<HTMLButtonElement> = (e): void => {
    e.preventDefault();

    if (recordingListFilePath) {
      fs.promises
        .readFile(recordingListFilePath)
        .then((content): Promise<RecordingItem[]> => lineByLineParser.parse(content.toString()))
        .then((recordingItems): void => {
          setRecordingList(recordingItems);
          setPageState('create-project');
        })
        .catch((e): void =>
          alert(`Failed to read parse recording list, reason: ${e instanceof Error ? e.message : e}`),
        );
    } else {
      alert('No file was chosen!');
    }
  };

  return (
    <Grid columns={16}>
      <Grid.Row columns={1}>
        <Grid.Column>
          <Header as={'h3'}>
            <I18nText i18nKey={'recording.list.page.header'} locale={locale} />
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row columns={1}>
        <Form>
          <Grid.Column>
            <Label htmlFor="recording-list-file">
              <I18nText i18nKey={'recording.list.page.help.text'} locale={locale} />
            </Label>
          </Grid.Column>
          <Grid.Column>
            <input
              type="file"
              id="recording-list-file"
              name="recording-list-file"
              onChange={onRecordingListFileSelected}
            />
          </Grid.Column>
        </Form>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={10}>
          {recordingListFilePath ? <span>Path: {recordingListFilePath}</span> : <span>No file selected yet!</span>}
        </Grid.Column>
        <Grid.Column width={6}>
          <Button onClick={readRecordingListFile}>Load Recording List</Button>
        </Grid.Column>
        <Grid.Column width={2}>
          <Button onClick={(): void => setRecordingList([])}>Clear</Button>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

i18n.register(
  {
    'recording.list.page.help.text': {
      [Locale.ZH_CN]: '选择录音表文件',
      [Locale.EN_US]: 'Choose the recording list file',
    },
  },
  {
    'recording.list.page.header': {
      [Locale.ZH_CN]: '读取录音表',
      [Locale.EN_US]: 'Load the Recording List',
    },
  },
);

export default LoadRecordingList;
