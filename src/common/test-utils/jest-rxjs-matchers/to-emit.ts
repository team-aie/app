import { Observable } from 'rxjs';

import { firstValueFrom } from '../../../renderer/utils';

import { expectEqual } from './expect-equal';

import CustomMatcher = jest.CustomMatcher;

/**
 * Naive implementation to test if an observable has emitted a specified value. For certain observables, this may
 * require a `shareReplay(1)` to replay its past values.
 *
 * This is an async matcher. Please use with `await` in the test case.
 */
export const toEmit: CustomMatcher = async function (actual, expected) {
  if (!(actual instanceof Observable)) {
    return {
      pass: false,
      message: () => `Given value is not an observable: ${actual}`,
    };
  }

  const actualValue = await firstValueFrom(actual);
  return expectEqual(this, 'toEmit', actualValue, expected);
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEmit<E = unknown>(expected: E): R;
    }
  }
}
