import React, { FC, Fragment, MouseEventHandler, useContext, useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';

import { RecordingProjectContext } from '../../contexts';
import { Consumer, RecordingProject } from '../../types';
import { ensureFolderExists, filename, openFilePicker } from '../../utils';
import BackButton from '../back-button';

import knownProjectDb from './known-projects';

interface ProjectRowProps {
  project: RecordingProject | undefined;
  onClick: Consumer<RecordingProject>;
  selected: boolean;
}

const ProjectRow: FC<ProjectRowProps> = ({ project, onClick, selected }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onClick={(): void => project && onClick(project)}
      style={selected || hovered ? { filter: 'invert(1)', textDecoration: 'underline' } : undefined}
      onMouseEnter={(): void => setHovered(true)}
      onMouseOut={(): void => setHovered(false)}>
      <td className={'border-bottom'}>{project && project.name}</td>
      <td className={'border-bottom'} align={'right'}>
        {project && project.lastAccessTime && project.lastAccessTime.toLocaleString()}
      </td>
    </tr>
  );
};

const OpenProjectPage: FC<{ onNext: Consumer<void>; onBack: MouseEventHandler<HTMLElement> }> = ({
  onNext,
  onBack,
}) => {
  const [projects, setProjects] = useState<RecordingProject[]>([]);
  {
    // Initialize the project array from stored projects
    useEffect(() => {
      knownProjectDb.knownProjects.toArray().then(setProjects);
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

  const { recordingProject, setRecordingProject } = useContext(RecordingProjectContext);

  const selectProject = async (project: RecordingProject): Promise<void> => {
    project.lastAccessTime = new Date();
    await knownProjectDb.knownProjects.put(project);
    setRecordingProject(project);
    onNext();
  };

  const createOrOpenProject = async (isNew: boolean): Promise<void> => {
    const folderPath = await openFilePicker(
      isNew ? 'new-folder' : 'folder',
      'Select Recording Project Output Folder',
      'Please select a folder to save voice samples.',
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
                  <th className={'border-top-0'}>Project Name</th>
                  <th className={'border-top-0 text-right'}>Last Access</th>
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
                  Create
                </Button>
              </Row>
              <Row style={{ marginTop: '0.75rem' }}>
                <Button
                  variant={'outline-secondary'}
                  style={{ width: '100%' }}
                  onClick={(): Promise<void> => createOrOpenProject(false)}>
                  Open
                </Button>
              </Row>
            </Col>
          </Row>
        </Col>
      </Container>
    </Fragment>
  );
};

export default OpenProjectPage;
