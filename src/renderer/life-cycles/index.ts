import { CleanUpLocalStorageTask } from './clean-up-local-storage-task';
import { LifeCycleManagerImpl } from './life-cycle-manager-impl';
import { ResetLocalStorageTask } from './reset-local-storage-task';
import { RestrictBodyOverflowIfProdTask } from './restrict-body-overflow-if-prod-task';
import { LifeCycleManager } from './types';

const lifeCycleManager: LifeCycleManager = new LifeCycleManagerImpl().register(
  new RestrictBodyOverflowIfProdTask(),
  new ResetLocalStorageTask(),
  // TODO: This task is only needed because there are (or used to be) bugs in interacting with Local Storage. Consider removing it once code reliability is up.
  new CleanUpLocalStorageTask(),
);

export default lifeCycleManager;
