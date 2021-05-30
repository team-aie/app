import { OTHER_RETAINED_KEYS, RESUME_SESSION_KEYS } from '../utils/localstorage-clear';

import { LifeCycleTask } from './types';

export class ResetLocalStorageTask implements LifeCycleTask {
  readonly name = 'ResetLocalStorageTask';

  /**
   * We clear unnecessary keys from {@link localStorage} with the exception for keys related to restoring sessions
   * or other exempt keys. See {@link RESUME_SESSION_KEYS} and {@link OTHER_RETAINED_KEYS}.
   */
  beforeRender = (): void => {
    const resumeSessionValues = RESUME_SESSION_KEYS.map((key) => localStorage.getItem(key));
    const otherRetainedValues = OTHER_RETAINED_KEYS.map((key) => localStorage.getItem(key));

    localStorage.clear();

    if (!resumeSessionValues.includes(null)) {
      for (let index = 0; index < RESUME_SESSION_KEYS.length; index++) {
        // Because it has been checked in the includes(null) check.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        localStorage.setItem(RESUME_SESSION_KEYS[index], resumeSessionValues[index]!);
      }
    }
    otherRetainedValues
      .map((value, i) => [OTHER_RETAINED_KEYS[i], value] as [string, string | null])
      .filter(([, value]) => value)
      // Because of the filter() call above.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .forEach(([key, value]) => localStorage.setItem(key, value!));
  };
}
