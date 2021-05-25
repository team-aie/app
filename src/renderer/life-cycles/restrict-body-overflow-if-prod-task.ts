import { isDevelopment } from '../../common/env-and-consts';

import { LifeCycleTask } from './types';

export class RestrictBodyOverflowIfProdTask implements LifeCycleTask {
  readonly name = 'RestrictBodyOverflowIfProdTask';

  beforeRender = (): void => {
    if (!isDevelopment) {
      document.body.style.overflow = 'hidden';
    }
  };
}
