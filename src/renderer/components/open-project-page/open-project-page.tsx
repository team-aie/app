import React, { FC, Fragment, MouseEventHandler, useContext, useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { useTranslation } from 'react-i18next';

import { RecordingProjectContext } from '../../contexts';
import { Consumer, RecordingProject } from '../../types';
import { ensureFolderExists, filename, openFilePicker } from '../../utils';
import { useResumeCheck } from '../../utils/localstorage-clear';
import BackButton from '../back-button';

import knownProjects from './known-projects';
import { ProjectRow } from './project-row';

interface OpenProjectPageProps {
  /**
   * Callback when the user chooses to resume from where they left off.
   */
  onResumeStatus: () => void;
  /**
   * Called when user chooses to navigate to next page.
   */
  onNext: Consumer<void>;
  /**
   * Called when user chooses to navigate to previous page.
   */
  onBack: MouseEventHandler<HTMLElement>;
}

export const OpenProjectPage: FC<OpenProjectPageProps> = ({ onResumeStatus, onNext, onBack }) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<RecordingProject[]>([]);
  {
    // Initialize the project array from stored projects
    useEffect(() => {
      knownProjects.toArray().then(setProjects);
    }, []);
  }

  const [error, setError] = useState<Error>();
  {
    // Alert on error
    useEffect(() => {
      if (error) {
        alert(error);
        setError(undefined);
      }
    }, [error]);
  }

  useResumeCheck(onResumeStatus);

  const { recordingProject, setRecordingProject } = useContext(RecordingProjectContext);

  const selectProject = async (project: RecordingProject): Promise<void> => {
    project.lastAccessTime = new Date();
    await knownProjects.put(project);
    setRecordingProject(project);
    onNext();
  };

  const createOrOpenProject = async (isNew: boolean): Promise<void> => {
    const folderPath = await openFilePicker(
      isNew ? 'new-folder' : 'folder',
      `${t('Select Recording Project Output Folder')}`,
      `${t('Please select a folder to save voice samples.')}`,
    );

    if (!folderPath) {
      return;
    }

    if (isNew) {
      await ensureFolderExists(folderPath);
    }

    const project = projects.find(({ rootPath }) => rootPath === folderPath) || {
      name: filename(folderPath),
      rootPath: folderPath,
    };

    return selectProject(project);
  };

  const projectsToDisplay: (RecordingProject | undefined)[] =
    projects.length >= 4 ? projects : [...Array(4)].map((x, i) => projects[i]);

  return (
    <Fragment>
      <BackButton onBack={onBack} />
      <Container style={{ height: '100%' }} className={'d-flex justify-content-center align-items-center'}>
        <Col xs={'auto'} sm={10} md={10} lg={10} xl={10}>
          <Row>
            <Table>
              <thead>
                <tr>
                  <th className={'border-top-0'}>{t('Project Name')}</th>
                  <th className={'border-top-0 text-right'}>{t('Last Access')}</th>
                </tr>
              </thead>
              <tbody>
                {projectsToDisplay.map((project, i) => (
                  <ProjectRow
                    key={i}
                    project={project}
                    selected={!!project && JSON.stringify(project) === JSON.stringify(recordingProject)}
                    onClick={selectProject}
                  />
                ))}
              </tbody>
            </Table>
          </Row>
          <Row className={'d-flex justify-content-end'}>
            <Col xs={5} sm={6} md={4} lg={3} xl={3}>
              <Row style={{ marginTop: '4rem' }}>
                <Button
                  variant={'outline-secondary'}
                  style={{ width: '100%' }}
                  onClick={(): Promise<void> => createOrOpenProject(true)}>
                  {t('Create')}
                </Button>
              </Row>
              <Row style={{ marginTop: '0.75rem' }}>
                <Button
                  variant={'outline-secondary'}
                  style={{ width: '100%' }}
                  onClick={(): Promise<void> => createOrOpenProject(false)}>
                  {t('Open')}
                </Button>
              </Row>
            </Col>
          </Row>
        </Col>
      </Container>
    </Fragment>
  );
};
