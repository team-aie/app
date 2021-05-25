import log from 'electron-log';

import { naivePrettyPrint } from '../utils';

import { LifeCycleTask } from './types';

export class CleanUpLocalStorageTask implements LifeCycleTask {
  readonly name = 'CleanUpLocalStorageTask';

  beforeRender = (): void => {
    const localStorageState = { ...localStorage };
    log.info(`Current local storage state: ${naivePrettyPrint(localStorageState)}`);
    for (const key in Object.getOwnPropertyNames(localStorageState)) {
      const storedValue = localStorage.getItem(key);
      log.debug(`Next key ${key} has next stored value: ${naivePrettyPrint(storedValue)}`);
      if (storedValue === 'null' || storedValue === 'undefined') {
        log.debug(`Removing key ${key} because it is possibly invalid`);
        localStorage.removeItem(key);
      }
    }
  };
}
