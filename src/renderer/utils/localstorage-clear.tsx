import log from 'electron-log';
import { useTranslation } from 'react-i18next';
import useEffectOnce from 'react-use/lib/useEffectOnce';

/**
 * {@link localStorage} keys that are needed to restore to a previous session.
 */
export const RESUME_SESSION_KEYS = [
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
 * Other {@link localStorage} keys that need to be exempted from being cleared on app start.
 */
export const OTHER_RETAINED_KEYS = ['AieAppHooks$isThemeOverriddenByUser', 'AieAppHooks$theme'];

const cleanUpLocalStorageOnAppQuit = (): void => {
  log.info('before clean', localStorage);
  const otherRetainedValues = OTHER_RETAINED_KEYS.map((key) => localStorage.getItem(key) || '');
  localStorage.clear();
  otherRetainedValues.forEach((value, i) => localStorage.setItem(OTHER_RETAINED_KEYS[i], value));
  log.info('after clean', localStorage);
};

/**
 * Check if an abnormal shutdown happened and prompt the user to see if they want to resume the last session.
 */
export const useAbnormalShutdownResumeSessionCheck = (goToRecordingPage: () => void): void => {
  const { t } = useTranslation();
  useEffectOnce(() => {
    window.addEventListener('unload', () => {
      log.info('Window is closed normally');
      cleanUpLocalStorageOnAppQuit();
    });

    const reservedStateValues = RESUME_SESSION_KEYS.map((state) => localStorage.getItem(state));
    if (!reservedStateValues.includes(null)) {
      log.info('Window is closed abnormally');
      if (confirm(`${t('We detected an abnormal shutdown. Do you want to continue from where you left off?')}`)) {
        goToRecordingPage();
      } else {
        RESUME_SESSION_KEYS.forEach((e) => localStorage.removeItem(e));
      }
    }
  });
};
