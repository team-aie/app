import { RETAINED_LOCALSTORAGE_KEYS } from '../utils/localstorage-clear';

import { LifeCycleTask } from './types';

export class ResetLocalStorageTask implements LifeCycleTask {
  readonly name = 'ResetLocalStorageTask';

  beforeRender = (): void => {
    const reservedStateValues = RETAINED_LOCALSTORAGE_KEYS.map((state) => localStorage.getItem(state));
    localStorage.clear();
    if (!reservedStateValues.includes(null)) {
      for (let index = 0; index < RETAINED_LOCALSTORAGE_KEYS.length; index++) {
        localStorage.setItem(RETAINED_LOCALSTORAGE_KEYS[index], reservedStateValues[index] || '');
      }
    }
  };
}
