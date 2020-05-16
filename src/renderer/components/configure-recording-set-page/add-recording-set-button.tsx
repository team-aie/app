import React, { FC } from 'react';
import Button from 'react-bootstrap/Button';
import { useTranslation } from 'react-i18next';

import { Consumer, RecordingSet, ScaleKey, SupportedOctave } from '../../types';

interface AddRecordingSetButtonProps {
  chosenKey: ScaleKey;
  chosenOctave: SupportedOctave;
  chosenName: string;
  chosenBuiltInList: string;
  chosenCustomListPath: string;
  existingSets: RecordingSet[];
  addRecordingSet: Consumer<RecordingSet>;
}

const AddRecordingSetButton: FC<AddRecordingSetButtonProps> = ({
  chosenKey,
  chosenOctave,
  chosenName,
  chosenBuiltInList,
  chosenCustomListPath,
  existingSets,
  addRecordingSet,
}) => {
  const { t } = useTranslation();
  const hasSetAllFields = chosenKey && chosenOctave && chosenName && (chosenBuiltInList || chosenCustomListPath);
  const canAdd = hasSetAllFields && !existingSets.find((set) => set.name === chosenName);

  return (
    <Button
      variant={'outline-secondary'}
      style={{ width: '5rem' }}
      disabled={!canAdd}
      onClick={(): void => {
        const newSet: RecordingSet = {
          name: chosenName,
          scale: {
            key: chosenKey,
            octave: chosenOctave,
          },
          recordingList: chosenBuiltInList
            ? {
                type: 'built-in',
                name: chosenBuiltInList,
              }
            : {
                type: 'custom-file',
                filePath: chosenCustomListPath,
              },
        };

        addRecordingSet(newSet);
      }}>
      {t('OK')}
    </Button>
  );
};

export default AddRecordingSetButton;
