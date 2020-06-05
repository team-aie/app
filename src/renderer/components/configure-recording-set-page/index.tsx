import log from 'electron-log';
import React, { FC, Fragment, MouseEventHandler, useContext, useEffect, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';
import CSSTransition from 'react-transition-group/CSSTransition';
import useLocalStorage from 'react-use/lib/useLocalStorage';

import { RecordingProjectContext } from '../../contexts';
import { PROJECT_CONFIG_FILENAME } from '../../env-and-consts';
import { Consumer, RecordingProject, RecordingSet, ScaleKey, SupportedOctave } from '../../types';
import {
  checkFileExistence,
  deleteFolder,
  ensureFolderExists,
  getLSKey,
  join,
  naiveSerialize,
  readFile,
  writeFile,
} from '../../utils';
import BackButton from '../back-button';
// import { Positional } from '../helper-components';
import NextButton from '../next-button';

import AddRecordingSetButton from './add-recording-set-button';
import CreatedRecordingSetList from './created-recording-set-list';
import SetMetaConfiguration from './set-meta-configuration';
import SetRecordingListConfiguration from './set-recording-list-configuration';

import './show-details.scss';

interface ProjectFile extends RecordingProject {
  name: string;
  recordingSets: RecordingSet[];
}

const DUMMY_PROJECT_FILE = {
  name: '',
  rootPath: '',
  recordingSets: [],
};

const DUMMY_BUILT_IN_LISTS = ['Chinese Mandarin - CVVC', 'Chinese Mandarin - VCV'];

const ConfigureRecordingSetPage: FC<{
  onNext: MouseEventHandler<HTMLElement>;
  onBack: MouseEventHandler<HTMLElement>;
  onSetSelected: Consumer<RecordingSet>;
}> = ({ onNext, onBack, onSetSelected }) => {
  const { t } = useTranslation();
  const { recordingProject } = useContext(RecordingProjectContext);
  const [projectFile = DUMMY_PROJECT_FILE, setProjectFile] = useLocalStorage<ProjectFile>(
    getLSKey('ConfigureRecordingSetPage', 'projectFile'),
    DUMMY_PROJECT_FILE,
  );
  const [recordingSets = [], setRecordingSets] = useLocalStorage<RecordingSet[]>(
    getLSKey('ConfigureRecordingSetPage', 'recordingSets'),
    [],
  );
  const [showingDetails = false, setShowingDetails] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'showingDetails'),
    false,
  );
  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    if (recordingProject) {
      (async (): Promise<void> => {
        const { rootPath } = recordingProject;
        const configFilePath = join(rootPath, PROJECT_CONFIG_FILENAME);

        const fileExistence = await checkFileExistence(configFilePath);
        if (!fileExistence) {
          setProjectFile(DUMMY_PROJECT_FILE);
        } else if (fileExistence === 'folder') {
          throw new Error(`Config file cannot be read because it is a directory: ${configFilePath}`);
        } else {
          // TODO Write a loader
          const projectState = JSON.parse(await readFile(configFilePath)) as ProjectFile;
          setProjectFile(projectState);
          setRecordingSets(projectState.recordingSets);
        }
        setCanWrite(true);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naiveSerialize(recordingProject), setProjectFile, setRecordingSets]);

  useEffect(() => {
    if (projectFile.recordingSets.length) {
      // FIXME Need real loading
      setRecordingSets(projectFile.recordingSets);
    }
  }, [projectFile, setRecordingSets]);

  const [chosenKey = 'C', setChosenKey] = useLocalStorage<ScaleKey>(
    getLSKey('ConfigureRecordingSetPage', 'chosenKey'),
    'C',
  );
  const [chosenOctave = 3, setChosenOctave] = useLocalStorage<SupportedOctave>(
    getLSKey('ConfigureRecordingSetPage', 'chosenOctave'),
    3,
  );
  const [chosenName = '', setChosenName] = useLocalStorage(getLSKey('ConfigureRecordingSetPage', 'chosenName'), '');
  const [chosenBuiltInList = '', rawSetChosenBuiltInList] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'chosenBuiltInList'),
    '',
  );
  const [chosenCustomListPath = '', rawSetChosenCustomListPath] = useLocalStorage(
    getLSKey('ConfigureRecordingSetPage', 'chosenCustomListPath'),
    '',
  );
  const setChosenBuiltInList = (name: string): void => {
    rawSetChosenBuiltInList(name);
    if (name) {
      rawSetChosenCustomListPath('');
    }
  };
  const setChosenCustomListPath = (filePath: string): void => {
    rawSetChosenCustomListPath(filePath);
    if (filePath) {
      rawSetChosenBuiltInList('');
    }
  };

  const addRecordingSet = async (newRecordingSet: RecordingSet): Promise<void> => {
    if (recordingProject) {
      const recordingSetPath = join(recordingProject.rootPath, newRecordingSet.name);
      await ensureFolderExists(recordingSetPath);
      setRecordingSets([...recordingSets, newRecordingSet]);
    }
  };

  const [selectedRecordingSetIndex = -1, setSelectedRecordingSetIndex] = useLocalStorage<number>(
    getLSKey('ConfigureRecordingSetPage', 'selectedRecordingSetIndex'),
    -1,
  );

  const removeRecordingSet = async (setToDelete: RecordingSet): Promise<void> => {
    const willDelete = confirm(`Are you sure you want to delete ${setToDelete.name}?`);
    if (willDelete) {
      const newSets = recordingSets.filter((x) => x !== setToDelete);
      setRecordingSets(newSets);

      if (recordingSets[selectedRecordingSetIndex] === setToDelete) {
        setSelectedRecordingSetIndex(-1);
      }

      if (recordingProject) {
        const willDeleteFiles = confirm(`Are you sure you want to delete the files also?`);
        if (willDeleteFiles) {
          const recordingSetPath = join(recordingProject.rootPath, setToDelete.name);
          return deleteFolder(recordingSetPath);
        }
      }
    }
  };

  const clearTemporaryItemsOnBack: typeof onBack = (e) => {
    setCanWrite(false);
    setChosenKey('C');
    setChosenOctave(3);
    setChosenName('');
    rawSetChosenBuiltInList('');
    rawSetChosenCustomListPath('');
    setSelectedRecordingSetIndex(-1);
    setProjectFile(DUMMY_PROJECT_FILE);
    setShowingDetails(false);
    setImmediate(() => onBack(e));
  };

  useEffect(() => {
    onSetSelected(recordingSets[selectedRecordingSetIndex]);
    // We have to ignore onSetSelected because it's new every time
    // eslint-disable-next-line
  }, [recordingSets, selectedRecordingSetIndex]);

  useEffect(() => {
    if (canWrite && recordingProject) {
      const currentProjectState: Partial<ProjectFile> = {
        name: recordingProject.name,
        recordingSets,
      };
      writeFile(
        join(recordingProject.rootPath, PROJECT_CONFIG_FILENAME),
        JSON.stringify(currentProjectState, null, 2),
      ).catch(log.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naiveSerialize(recordingProject), naiveSerialize(recordingSets)]);

  return (
    <Fragment>
      <BackButton onBack={clearTemporaryItemsOnBack} />
      <Container style={{ height: '100%' }} className={'d-flex justify-content-center align-items-center'}>
        <Col>
          <Row>
            <SetMetaConfiguration
              chosenKey={chosenKey}
              setChosenKey={setChosenKey}
              chosenOctave={chosenOctave}
              setChosenOctave={setChosenOctave}
              chosenName={chosenName}
              setChosenName={setChosenName}
            />
          </Row>
          <Row>
            <SetRecordingListConfiguration
              builtInLists={DUMMY_BUILT_IN_LISTS}
              chosenBuiltInList={chosenBuiltInList}
              setChosenBuiltInList={setChosenBuiltInList}
              chosenCustomListPath={chosenCustomListPath}
              setChosenCustomListPath={setChosenCustomListPath}
            />
            <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
              <AddRecordingSetButton
                chosenKey={chosenKey}
                chosenOctave={chosenOctave}
                chosenName={chosenName}
                chosenBuiltInList={chosenBuiltInList}
                chosenCustomListPath={chosenCustomListPath}
                existingSets={recordingSets}
                addRecordingSet={addRecordingSet}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: '1rem' }}>
            <Col xs={2} sm={2} md={2} lg={2} xl={2}>
              {t('Created')}
            </Col>
            <Col xs={'auto'} sm={8} md={8} lg={8} xl={8}>
              <CreatedRecordingSetList
                recordingSets={recordingSets}
                removeRecordingSet={removeRecordingSet}
                selectedRecordingSetIndex={selectedRecordingSetIndex}
                setSelectedRecordingSetIndex={setSelectedRecordingSetIndex}
              />
            </Col>
            <Col />
          </Row>
        </Col>
      </Container>
      <NextButton text={t('Start')} onClick={onNext} disabled={selectedRecordingSetIndex < 0} />
      <CSSTransition in={showingDetails} timeout={200} classNames={'move-up-in-down-out'}>
        <div
          // position={'bottom-center'}
          style={{ bottom: undefined, display: 'hidden' }}
          className={`show-details ${
            showingDetails ? 'move-up-in-down-out-start-in' : 'move-up-in-down-out-start-out'
          }`}
          onClick={(): void => setShowingDetails(showingDetails)}>
          {t('Show Details')}
        </div>
      </CSSTransition>
    </Fragment>
  );
};

export default ConfigureRecordingSetPage;
