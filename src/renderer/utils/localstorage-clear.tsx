import { useTranslation } from 'react-i18next';
import { useEffectOnce } from 'react-use';

/**
 * Values to be used to determine whether the user is at the Recording Page before closing the application
 */
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

/**
 * Function used to check the localStorage to determine whether user needs to be reminded of resuming status
 */
export const useResumeCheck = (goToRecordingPage: () => void): void => {
  const { t } = useTranslation();
  useEffectOnce(() => {
    /**
     * This event fires when the window is unloading its content and resources. Unusual shutdown of the window won't trigger this event.
     */
    window.addEventListener('unload', function () {
      localStorage.clear();
    });
    const reservedStateValues = RETAINED_LOCALSTORAGE_KEYS.map((state) => localStorage.getItem(state));
    if (!reservedStateValues.includes(null)) {
      if (confirm(`${t('We detected an abnormal shutdown. Do you want to continue from where you left off?')}`)) {
        goToRecordingPage();
      } else {
        RETAINED_LOCALSTORAGE_KEYS.forEach((e) => localStorage.removeItem(e));
      }
    }
  });
};
