import chokidar from 'chokidar';
import { Subject } from 'rxjs';

import { Event, Monitor } from './Monitor';

// type Event = 'unlink' | 'unlinkDir' | 'add' | 'addDir' | 'change' | 'error';

class FileMonitor implements Monitor {
  //The main functionality of the file monitor is to report selected type of events using the Observable called subject
  private folderPath: string;
  //ignoredPath: string;
  private events: Array<Event>;
  private eventsWatching: Array<Event>;
  private subject: Subject<[Event, string]>;
  private addWatcher: chokidar.FSWatcher;
  private addDirWatcher: chokidar.FSWatcher;
  private unlinkWatcher: chokidar.FSWatcher;
  private unlinkDirWatcher: chokidar.FSWatcher;
  private changeWatcher: chokidar.FSWatcher;
  private errorWatcher: chokidar.FSWatcher;

  //construct with the folder path that you want to monitor and ignoredPath that the watcher will ignore
  constructor(folderPath: string) {
    this.subject = new Subject();
    this.folderPath = folderPath;
    //this.ignoredPath = ignoredPath;
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

  //Input: array of events
  //note that the events can be added to the watcher but CANNOT be removed from watcher
  public watch(events: Array<Event>): void {
    this.events.push(...events);
    //unlink: files being deleted
    if (this.events.includes('unlink') && !this.eventsWatching.includes('unlink')) {
      this.eventsWatching.push('unlink');
      this.unlinkWatcher.on('unlink', (path) => {
        this.subject.next(['unlink', `${path}`]);
      });
    }
    if (this.events.includes('unlinkDir') && !this.eventsWatching.includes('unlinkDir')) {
      this.eventsWatching.push('unlinkDir');
      this.unlinkDirWatcher.on('unlinkDir', (path) => {
        this.subject.next(['unlinkDir', `${path}`]);
      });
    }
    //add: files being added
    if (this.events.includes('add') && !this.eventsWatching.includes('add')) {
      this.eventsWatching.push('add');
      this.addWatcher.on('add', (path) => {
        this.subject.next(['add', `${path}`]);
      });
    }
    if (this.events.includes('addDir') && !this.eventsWatching.includes('addDir')) {
      this.eventsWatching.push('addDir');
      this.addDirWatcher.on('addDir', (path) => {
        this.subject.next(['addDir', `${path}`]);
      });
    }
    if (this.events.includes('change') && !this.eventsWatching.includes('change')) {
      this.eventsWatching.push('change');
      this.addDirWatcher.on('change', (path) => {
        this.subject.next(['change', `${path}`]);
      });
    }
    //error: errors occured
    if (this.events.includes('error') && !this.eventsWatching.includes('error')) {
      this.eventsWatching.push('error');
      this.errorWatcher.on('error', (error) => {
        this.subject.error(['error', `${error}`]);
      });
    }
  }
  public unwatch(events: Array<string>): void {
    if (events.includes('add')) {
      this.events = this.events.filter((e) => e !== 'add');
      this.eventsWatching = this.eventsWatching.filter((e) => e !== 'add');
      this.addWatcher.close();
    }
    if (events.includes('addDir')) {
      this.events = this.events.filter((e) => e !== 'addDir');
      this.eventsWatching = this.eventsWatching.filter((e) => e !== 'addDir');
      this.addDirWatcher.close();
    }
    if (events.includes('unlink')) {
      this.events = this.events.filter((e) => e !== 'unlink');
      this.eventsWatching = this.eventsWatching.filter((e) => e !== 'unlink');
      this.unlinkWatcher.close();
    }
    if (events.includes('unlinkDir')) {
      this.events = this.events.filter((e) => e !== 'unlinkDir');
      this.eventsWatching = this.eventsWatching.filter((e) => e !== 'unlinkDir');
      this.unlinkDirWatcher.close();
    }
    if (events.includes('change')) {
      this.events = this.events.filter((e) => e !== 'change');
      this.eventsWatching = this.eventsWatching.filter((e) => e !== 'change');
      this.changeWatcher.close();
    }
    if (events.includes('error')) {
      this.events = this.events.filter((e) => e !== 'error');
      this.eventsWatching = this.eventsWatching.filter((e) => e !== 'error');
      this.errorWatcher.close();
    }
  }

  public ignoreFiles(eventToIgnore: Array<Event>, ignoredFilepath: Array<string>): void {
    if (eventToIgnore.includes('add')) {
      if (!this.eventsWatching.includes('add')) {
        if (!this.events.includes('add')) {
          this.events.push('add');
        }
        this.eventsWatching.push('add');
      }
      this.addWatcher.close();
      this.addWatcher = chokidar.watch(this.folderPath, {
        ignored: [/(^|[/\\])\../, ...ignoredFilepath],
        followSymlinks: false,
        persistent: true,
      });
      this.addWatcher.on('add', (path) => {
        this.subject.next(['add', `${path}`]);
      });
    }
    if (eventToIgnore.includes('addDir')) {
      if (!this.eventsWatching.includes('addDir')) {
        if (!this.events.includes('addDir')) {
          this.events.push('addDir');
        }
        this.eventsWatching.push('addDir');
      }
      this.addDirWatcher.close();
      this.addDirWatcher = chokidar.watch(this.folderPath, {
        ignored: [/(^|[/\\])\../, ...ignoredFilepath],
        followSymlinks: false,
        persistent: true,
      });
      this.addDirWatcher.on('addDir', (path) => {
        this.subject.next(['addDir', `${path}`]);
      });
    }
    if (eventToIgnore.includes('unlink')) {
      if (!this.eventsWatching.includes('unlink')) {
        if (!this.events.includes('unlink')) {
          this.events.push('unlink');
        }
        this.eventsWatching.push('unlink');
      }
      this.unlinkWatcher.close();
      this.unlinkWatcher = chokidar.watch(this.folderPath, {
        ignored: [/(^|[/\\])\../, ...ignoredFilepath],
        followSymlinks: false,
        persistent: true,
      });
      this.unlinkWatcher.on('unlink', (path) => {
        this.subject.next(['unlink', `${path}`]);
      });
    }
    if (eventToIgnore.includes('unlinkDir')) {
      if (!this.eventsWatching.includes('unlinkDir')) {
        if (!this.events.includes('unlinkDir')) {
          this.events.push('unlinkDir');
        }
        this.eventsWatching.push('unlinkDir');
      }
      this.unlinkDirWatcher.close();
      this.unlinkDirWatcher = chokidar.watch(this.folderPath, {
        ignored: [/(^|[/\\])\../, ...ignoredFilepath],
        followSymlinks: false,
        persistent: true,
      });
      this.unlinkDirWatcher.on('unlinkDir', (path) => {
        this.subject.next(['unlinkDir', `${path}`]);
      });
    }
    if (eventToIgnore.includes('change')) {
      if (!this.eventsWatching.includes('change')) {
        if (!this.events.includes('change')) {
          this.events.push('change');
        }
        this.eventsWatching.push('change');
      }
      this.changeWatcher.close();
      this.changeWatcher = chokidar.watch(this.folderPath, {
        ignored: [/(^|[/\\])\../, ...ignoredFilepath],
        followSymlinks: false,
        persistent: true,
      });
      this.changeWatcher.on('change', (path) => {
        this.subject.next(['change', `${path}`]);
      });
    }
    if (eventToIgnore.includes('error')) {
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

  public closeAll(): void {
    this.addWatcher.close();
    this.addDirWatcher.close();
    this.unlinkWatcher.close();
    this.unlinkDirWatcher.close();
    this.changeWatcher.close();
    this.errorWatcher.close();
  }

  public getEvents(): Array<Event> {
    return this.events;
  }
  public getEventsWatching(): Array<Event> {
    return this.eventsWatching;
  }

  public getSubject(): Subject<[Event, string]> {
    return this.subject;
  }
}

export default FileMonitor;
