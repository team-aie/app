import React from 'react';

/**
 * Task that needs to be run at different life cycle hooks.
 */
export interface LifeCycleTask {
  readonly name: string;

  /**
   * Command that needs to run after the app has initialized but before the main UI is rendered.
   */
  beforeRender?: () => Promise<void> | void;

  /**
   * Command that needs to run when the app is going to quit.
   */
  beforeUnload?: () => Promise<void> | void;
}

export type ReactComponentFactory = Parameters<typeof React.lazy>[0];
export type ReactComponentFactoryReturnType = ReturnType<ReactComponentFactory>;

export interface LifeCycleManager {
  /**
   * Registers a {@link LifeCycleTask} to this manager. Allows duplication. Order matters.
   */
  register: (...tasks: LifeCycleTask[]) => this;

  /**
   * Unregisters a {@link LifeCycleTask} to this manager. Duplicated registration needs duplicate calls. Order matters.
   * Uses {@link Object.is} to determine equality.
   */
  unregister: (...tasks: LifeCycleTask[]) => this;

  /**
   * Prepares the original factory taken by {@link React.lazy} with life cycle hooks registered with this manager.
   * @param appFactory See {@link https://reactjs.org/docs/code-splitting.html#reactlazy} for what {@link React.lazy}
   *   takes.
   */
  bootstrap: (appFactory: ReactComponentFactory) => () => ReactComponentFactoryReturnType;
}
