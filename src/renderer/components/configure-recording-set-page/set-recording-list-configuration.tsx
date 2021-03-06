import React, { FC, Fragment } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';

import { Consumer } from '../../types';
import { filename, openFilePicker } from '../../utils';
import Select from '../select';

import { BuiltInRecordingList } from './types';

interface SetRecordingListConfigurationProps {
  builtInLists: string[];
  chosenBuiltInList: string;
  setChosenBuiltInList: Consumer<BuiltInRecordingList | ''>;
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
          <Select
            className={'w-100'}
            style={{ paddingRight: '0.75rem' }}
            value={chosenBuiltInList}
            testId={'selectReclist'}
            onChange={(e): void => {
              setChosenBuiltInList(e.target.value as BuiltInRecordingList);
            }}>
            <option value={''} />
            {builtInLists.map((builtInList) => (
              <option key={builtInList} value={builtInList}>
                {builtInList}
              </option>
            ))}
          </Select>
        </Row>
      </Col>
      <Col>
        <Button
          data-testid={'cust-list-button'}
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
