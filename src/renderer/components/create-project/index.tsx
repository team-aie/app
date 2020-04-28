import * as fs from 'fs';

import { remote } from 'electron';
import React, { ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Grid, Header } from 'semantic-ui-react';

import { Consumer, PageState } from '../../types';

interface CreateProjectProps {
  setPageState: Consumer<PageState>;
  projectFolder: string;
  setProjectFolder: Consumer<string>;
  scales: string[];
  setScales: Consumer<string[]>;
}

const ensureFolderExists = async (filepath: string): Promise<void> => {
  if (fs.existsSync(filepath)) {
    const stat = await fs.promises.lstat(filepath);
    if (!stat.isDirectory()) {
      alert(`Selected path exists and is not a directory: ${filepath}!`);
      return;
    }
  } else {
    try {
      await fs.promises.mkdir(filepath);
      alert(`We created a new directory at ${filepath}`);
    } catch (e) {
      alert(`Failed to create new directory at ${filepath}!`);
      return;
    }
  }
};

const CreateProject = ({
  setPageState,
  projectFolder,
  setProjectFolder,
  scales,
  setScales,
}: CreateProjectProps): ReactElement => {
  const { t } = useTranslation();
  const [userInputtedScale, setUserInputtedScale] = useState('');

  /**
   * Currently, the user has to choose the right directory on the first try.
   * We can break this function into two steps to make it less error-prone.
   */
  const getProjectFolderFromUser = async (): Promise<void> => {
    const { canceled, filePaths } = await remote.dialog.showOpenDialog({
      title: t('Select Project Output Folder'),
      message: t('Please select a folder to save voice samples.'),
      properties: ['openDirectory', 'showHiddenFiles', 'createDirectory', 'promptToCreate'],
    });

    if (canceled || !filePaths.length) {
      return;
    }
    const filepath = filePaths[0];

    await ensureFolderExists(filepath);

    setProjectFolder(filepath);
  };

  // Set output folder and scale
  return (
    <Grid columns={16} divided="vertically">
      <Grid.Row columns={1}>
        <Grid.Column>
          <Header as={'h3'}>{t('Create a Project')}</Header>
          <Button onClick={(): void => setPageState('start')}>Back</Button>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={4}>
          <Button onClick={getProjectFolderFromUser}>Select Folder</Button>
        </Grid.Column>
        <Grid.Column width={12}>
          {projectFolder ? <span>Folder path: {projectFolder}</span> : <span>No folder selected yet!</span>}
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={2}>
          <span>Add Scales:</span>
        </Grid.Column>
        <Grid.Column width={4}>
          <input type={'text'} value={userInputtedScale} onChange={(e): void => setUserInputtedScale(e.target.value)} />
        </Grid.Column>
        <Grid.Column width={5}>
          <Button disabled={!userInputtedScale} onClick={(): void => setScales([...scales, userInputtedScale])}>
            Add
          </Button>
          <Button disabled={!scales.length} onClick={(): void => setScales([])}>
            Remove All
          </Button>
        </Grid.Column>
        <Grid.Column width={5}>
          {scales.length ? <span>Added scales: {scales.join(', ')}</span> : <span>Please add at least one scale</span>}
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={2}>
          <Button
            disabled={!(projectFolder && scales.length)}
            onClick={async (): Promise<void> => {
              await ensureFolderExists(projectFolder);
              setProjectFolder(projectFolder);
              setScales(scales);
              setPageState('recording-studio');
            }}>
            Create!
          </Button>
        </Grid.Column>
        <Grid.Column width={2}>
          <Button
            onClick={(): void => {
              setProjectFolder('');
              setScales([]);
              setUserInputtedScale('');
            }}>
            Clear
          </Button>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CreateProject;
