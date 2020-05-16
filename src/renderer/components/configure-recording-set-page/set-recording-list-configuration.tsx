import React, { FC, Fragment } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';

import { Consumer } from '../../types';
import { filename, openFilePicker } from '../../utils';

interface SetRecordingListConfigurationProps {
  builtInLists: string[];
  chosenBuiltInList: string;
  setChosenBuiltInList: Consumer<string>;
  chosenCustomListPath: string;
  setChosenCustomListPath: Consumer<string>;
}

const SetRecordingListConfiguration: FC<SetRecordingListConfigurationProps> = ({
  builtInLists,
  chosenBuiltInList,
  setChosenBuiltInList,
  chosenCustomListPath,
  setChosenCustomListPath,
}) => {
  const { t } = useTranslation();
  return (
    <Fragment>
      <Col xs={'auto'} sm={7} md={7} lg={7} xl={7}>
        <Row>
          <Form className={'w-100'}>
            <Form.Group style={{ paddingRight: '0.75rem' }}>
              <Form.Control
                as={'select'}
                className={'border-top-0 border-right-0 border-left-0 rounded-0'}
                value={chosenBuiltInList}
                onChange={(e): void => setChosenBuiltInList(e.target.value)}>
                <option value={''} />
                {builtInLists.map((builtInList) => (
                  <option key={builtInList} value={builtInList}>
                    {builtInList}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
          </Form>
        </Row>
      </Col>
      <Col>
        <Button
          variant={'outline-secondary'}
          className={'text-truncate'}
          style={{
            width: '9rem',
          }}
          onClick={async (): Promise<void> => {
            const recordingListFilePath = await openFilePicker(
              'file',
              `${t('Select Custom Recording List')}`,
              `${t('Please select a custom recording list file.')}`,
            );
            if (!recordingListFilePath) {
              return;
            }
            setChosenCustomListPath(recordingListFilePath);
          }}>
          {(chosenCustomListPath && filename(chosenCustomListPath)) || t('Custom...')}
        </Button>
      </Col>
    </Fragment>
  );
};

export default SetRecordingListConfiguration;
