import log from 'electron-log';

import { capitalizeFirst } from '../utils';

import { LifeCycleManager, LifeCycleTask, ReactComponentFactory, ReactComponentFactoryReturnType } from './types';

type HookType<T> = T extends keyof LifeCycleTask ? (LifeCycleTask[T] extends string ? never : T) : never;

export class LifeCycleManagerImpl implements LifeCycleManager {
  private readonly tasks: LifeCycleTask[] = [];

  register = (...tasks: LifeCycleTask[]): this => {
    this.tasks.push(...tasks);
    return this;
  };

  unregister = (...tasks: LifeCycleTask[]): this => {
    for (const task of tasks) {
      const index = this.tasks.findIndex((value) => Object.is(value, task));
      if (index >= 0) {
        this.tasks.splice(index, 1);
      }
    }
    return this;
  };

  bootstrap = (appFactory: ReactComponentFactory): (() => ReactComponentFactoryReturnType) => {
    return async () => {
      await this.runHooks('beforeRender');
      window.addEventListener('unload', () => {
        this.runHooks('beforeUnload').catch(log.error);
      });

      return appFactory();
    };
  };

  private runHooks = async (type: HookType<keyof LifeCycleTask>): Promise<void> => {
    const typeName = capitalizeFirst(type);
    for (const task of this.tasks) {
      const { name } = task;
      log.info(`Running ${typeName} hook for ${name}`);
      try {
        const hook = task[type];
        if (hook) {
          await hook();
        }
      } catch (e) {
        log.error(`${typeName} hook for ${name} encounters an error:`, e);
      }
    }
  };
}
