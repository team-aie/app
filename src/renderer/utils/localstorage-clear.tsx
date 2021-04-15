import { useTranslation } from 'react-i18next';
import { useEffectOnce } from 'react-use';

export const RETAINED_LOCALSTORAGE_KEYS = [
  'AieApp$keyOctave',
  'AieApp$projectFolder',
  'AieApp$recordingProject',
  'AieApp$recordingSet',
  'AieApp$recordingList',
  'ConfigureRecordingSetPage$recordingSets',
  'ConfigureRecordingSetPage$projectFile',
  'RecordingPage$index',
];

export const useResumeCheck = (goToRecordingPage: () => void) => {
  const { t } = useTranslation();
  useEffectOnce(() => {
    const reservedStateValues = RETAINED_LOCALSTORAGE_KEYS.map((state) => localStorage.getItem(state));
    if (!reservedStateValues.includes(null)) {
      if (confirm(`${t('Do you want to continue from where you left off?')}`)) {
        goToRecordingPage();
      } else {
        RETAINED_LOCALSTORAGE_KEYS.forEach((e) => localStorage.removeItem(e));
      }
    }
  });
  return null;
};
