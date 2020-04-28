import * as fs from 'fs';

import React, { ChangeEventHandler, FC, MouseEventHandler, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Grid, Header, Label } from 'semantic-ui-react';

import { Consumer, PageState, RecordingItem } from '../../types';

import lineByLineParser from './line-by-line-parser';

interface LoadRecordingListProps {
  setPageState: Consumer<PageState>;
  setRecordingList: Consumer<RecordingItem[]>;
}

const LoadRecordingList: FC<LoadRecordingListProps> = ({ setPageState, setRecordingList }) => {
  const { t } = useTranslation();
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
          <Header as={'h3'}>{t('Load Recording List')}</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row columns={1}>
        <Form>
          <Grid.Column>
            <Label htmlFor={'recording-list-file'}>{t('Choose the recording list file')}</Label>
          </Grid.Column>
          <Grid.Column>
            <input
              type={'file'}
              id={'recording-list-file'}
              name={'recording-list-file'}
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

export default LoadRecordingList;
