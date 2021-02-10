import chokidar from 'chokidar';
import { Subject } from 'rxjs';

import { Event, Monitor } from './types';

class FileMonitor implements Monitor {
  /**
   * The main functionality of the file monitor is to report selected type of events using the Observable called subject
   *
   * */
  private folderPath: string;
  private events: Event[];
  private eventsWatching: Event[];
  private subject: Subject<[Event, string]>;
  private addWatcher: chokidar.FSWatcher;
  private addDirWatcher: chokidar.FSWatcher;
  private unlinkWatcher: chokidar.FSWatcher;
  private unlinkDirWatcher: chokidar.FSWatcher;
  private changeWatcher: chokidar.FSWatcher;
  private errorWatcher: chokidar.FSWatcher;

  constructor(folderPath: string) {
    /**
     * @param folderPath - the array of file directories that needs to be watched
     *
     * */
    this.subject = new Subject();
    this.folderPath = folderPath;
    this.events = [];
    this.eventsWatching = [];
    this.addWatcher = chokidar.watch(this.folderPath, {
      ignored: [/(^|[/\\])\../],
      followSymlinks: false,
      persistent: true,
    });
    this.addDirWatcher = chokidar.watch(this.folderPath, {
      ignored: [/(^|[/\\])\../],
      followSymlinks: false,
      persistent: true,
    });
    this.unlinkWatcher = chokidar.watch(this.folderPath, {
      ignored: [/(^|[/\\])\../],
      followSymlinks: false,
      persistent: true,
    });
    this.unlinkDirWatcher = chokidar.watch(this.folderPath, {
      ignored: [/(^|[/\\])\../],
      followSymlinks: false,
      persistent: true,
    });
    this.changeWatcher = chokidar.watch(this.folderPath, {
      ignored: [/(^|[/\\])\../],
      followSymlinks: false,
      persistent: true,
    });
    this.errorWatcher = chokidar.watch(this.folderPath, {
      ignored: [/(^|[/\\])\../],
      followSymlinks: false,
      persistent: true,
    });
  }

  watch(events: Event[]): void {
    /**
     * Start watcher on events input.
     *
     * @param events - the array of events that needs to be watched
     * @returns void
     *
     */
    this.events.push(...events);
    this.watchHelper('add', this.addWatcher);
    this.watchHelper('addDir', this.addDirWatcher);
    this.watchHelper('unlink', this.unlinkWatcher);
    this.watchHelper('unlinkDir', this.unlinkDirWatcher);
    this.watchHelper('change', this.changeWatcher);
    // error: errors occured
    if (this.events.includes('error') && !this.eventsWatching.includes('error')) {
      this.eventsWatching.push('error');
      this.errorWatcher.on('error', (error) => {
        this.subject.error(['error', `${error}`]);
      });
    }
  }

  unwatch(events: Event[]): void {
    /**
     * Stop watcher on events input.
     *
     * @param events - the array of events that no longer needs to be watched
     * @returns void
     *
     */
    this.unwatchHelper(events, 'add', this.addWatcher);
    this.unwatchHelper(events, 'addDir', this.addDirWatcher);
    this.unwatchHelper(events, 'unlink', this.unlinkWatcher);
    this.unwatchHelper(events, 'unlinkDir', this.unlinkDirWatcher);
    this.unwatchHelper(events, 'change', this.changeWatcher);
    this.unwatchHelper(events, 'error', this.errorWatcher);
  }

  ignoreFiles(eventsToIgnore: Event[], ignoredFilepath: Array<string>): void {
    /**
     * Stop watching on the events input of filepaths input
     *
     * @param eventsToIgnore - the array of events that no longer needs to be watched
     * @param ignoredFilepath - the array of filepaths that no longer needs to be watched
     * @returns void
     *
     */
    if (eventsToIgnore.includes('add')) {
      this.ignoreHelper('add', ignoredFilepath, this.addWatcher);
    }
    if (eventsToIgnore.includes('addDir')) {
      this.ignoreHelper('addDir', ignoredFilepath, this.addDirWatcher);
    }
    if (eventsToIgnore.includes('unlink')) {
      this.ignoreHelper('unlink', ignoredFilepath, this.unlinkWatcher);
    }
    if (eventsToIgnore.includes('unlinkDir')) {
      this.ignoreHelper('unlinkDir', ignoredFilepath, this.unlinkDirWatcher);
    }
    if (eventsToIgnore.includes('change')) {
      this.ignoreHelper('change', ignoredFilepath, this.changeWatcher);
    }
    if (eventsToIgnore.includes('error')) {
      if (!this.eventsWatching.includes('error')) {
        if (!this.events.includes('error')) {
          this.events.push('error');
        }
        this.eventsWatching.push('error');
      }
      this.errorWatcher.close();
      this.errorWatcher = chokidar.watch(this.folderPath, {
        ignored: [/(^|[/\\])\../, ...ignoredFilepath],
        followSymlinks: false,
        persistent: true,
      });
      this.errorWatcher.on('error', (path) => {
        this.subject.error(['error', `${path}`]);
      });
    }
  }

  closeAll(): void {
    this.addWatcher.close();
    this.addDirWatcher.close();
    this.unlinkWatcher.close();
    this.unlinkDirWatcher.close();
    this.changeWatcher.close();
    this.errorWatcher.close();
  }

  private watchHelper(event: Event, watcher: chokidar.FSWatcher): void {
    if (this.events.includes(event) && !this.eventsWatching.includes(event)) {
      this.eventsWatching.push(event);
      watcher.on(event, (path) => {
        this.subject.next([event, `${path}`]);
      });
    }
  }

  private unwatchHelper(events: Event[], eventToUnwatch: Event, watcher: chokidar.FSWatcher): void {
    if (events.includes(eventToUnwatch)) {
      this.events = this.events.filter((e) => e !== eventToUnwatch);
      this.eventsWatching = this.eventsWatching.filter((e) => e !== eventToUnwatch);
      watcher.close();
    }
  }

  private ignoreHelper(ignoreEvent: Event, ignoreFilepath: Array<string>, ignoreWatcher: chokidar.FSWatcher) {
    if (!this.eventsWatching.includes(ignoreEvent)) {
      if (!this.events.includes(ignoreEvent)) {
        this.events.push(ignoreEvent);
      }
      this.eventsWatching.push(ignoreEvent);
    }
    ignoreWatcher.close();
    ignoreWatcher = chokidar.watch(this.folderPath, {
      ignored: [/(^|[/\\])\../, ...ignoreFilepath],
      followSymlinks: false,
      persistent: true,
    });
    ignoreWatcher.on(ignoreEvent, (path) => {
      this.subject.next([ignoreEvent, `${path}`]);
    });
  }

  getEvents(): Event[] {
    return this.events;
  }

  getEventsWatching(): Event[] {
    return this.eventsWatching;
  }

  getSubject(): Subject<[Event, string]> {
    return this.subject;
  }
}

export { FileMonitor };
