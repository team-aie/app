import log from 'electron-log';

import { LifeCycleManager, LifeCycleTask, ReactComponentFactory, ReactComponentFactoryReturnType } from './types';

export class LifeCycleManagerImpl implements LifeCycleManager {
  private readonly tasks: LifeCycleTask[] = [];

  register = (...tasks: LifeCycleTask[]): this => {
    this.tasks.push(...tasks);
    return this;
  };

  bootstrap = (appFactory: ReactComponentFactory): (() => ReactComponentFactoryReturnType) => {
    return async () => {
      await this.runBeforeRenderHooks();

      return appFactory();
    };
  };

  private runBeforeRenderHooks = async (): Promise<void> => {
    for (const task of this.tasks) {
      const { name } = task;
      log.info(`Running BeforeRender hook for ${name}`);
      try {
        await task.beforeRender();
      } catch (e) {
        log.error(`BeforeRender hook ${name} encounters an error: ${e}`);
      }
    }
  };
}
