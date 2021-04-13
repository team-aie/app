import { useTranslation } from 'react-i18next';
import { useEffectOnce } from 'react-use';

import { RETAINED_LOCALSTORAGE_KEYS } from '../../common/env-and-consts';

const useResumeCheck = (func: () => void) => {
  const { t } = useTranslation();
  useEffectOnce(() => {
    const reservedStateValues = RETAINED_LOCALSTORAGE_KEYS.map((state) => localStorage.getItem(state));
    if (!reservedStateValues.includes(null)) {
      if (confirm(`${t('Do you want to continue from where you left off?')}`)) {
        func();
      } else {
        RETAINED_LOCALSTORAGE_KEYS.forEach((e) => localStorage.removeItem(e));
      }
    }
  });
};

export default useResumeCheck;
