import chokidar from 'chokidar';
import { Subject } from 'rxjs';

class FileMonitor {
  //The main functionality of the file monitor is to report selected type of events using the Observable called subject
  folderPath: string;
  ignoredPath: string;
  events: Array<string>;
  eventsWatching: Array<string>;
  watcher: chokidar.FSWatcher;
  subject: any;

  //construct with the folder path that you want to monitor and ignoredPath that the watcher will ignore
  constructor(folderPath: string, ignoredPath: string) {
    this.subject = new Subject();
    this.folderPath = folderPath;
    this.ignoredPath = ignoredPath;
    this.events = [];
    this.eventsWatching = [];
    this.watcher = chokidar.watch(this.folderPath, {
      ignored: [/(^|[/\\])\../, this.ignoredPath],
      followSymlinks: false,
      persistent: true,
    });
  }

  //Input: array of events
  //note that the events can be added to the watcher but CANNOT be removed from watcher
  public watch(events: Array<string>): void {
    this.events.push(...events);
    //unlink: files being deleted
    if (this.events.includes('unlink') && !this.eventsWatching.includes('unlink')) {
      this.eventsWatching.push('unlink');
      this.watcher
        .on('unlink', (path) => {
          //alert(`File ${path} has been removed`);
          this.subject.next(['unlink', `${path}`]);
        })
        .on('unlinkDir', (path) => {
          //alert(`File ${path} has been removed`);
          this.subject.next(['unlinkDir', `${path}`]);
        });
    }
    //add: files being added
    if (this.events.includes('add') && !this.eventsWatching.includes('add')) {
      this.eventsWatching.push('add');
      this.watcher
        .on('add', (path) => {
          //alert(`File ${path} has been added`);
          this.subject.next(['add', `${path}`]);
        })
        .on('addDir', (path) => {
          //alert(`File ${path} has been added`);
          this.subject.next(['addDir', `${path}`]);
        });
    }
    //change: files being changed
    if (this.events.includes('change') && !this.eventsWatching.includes('change')) {
      this.eventsWatching.push('change');
      this.watcher.on('change', (path) => {
        //alert(`File ${path} has been changed`);
        this.subject.next(['change', `${path}`]);
      });
    }
    //error: errors occured
    if (this.events.includes('error') && !this.eventsWatching.includes('error')) {
      this.eventsWatching.push('error');
      this.watcher.on('error', (error) => {
        //alert(`Error happened ${error}`);
        this.subject.next(['error', `${error}`]);
      });
    }
  }

  //used to remove the events from events array, but it will not affect the watcher
  public removeEvents(event: string): void {
    const newValue = this.events.filter((e) => e !== event);
    this.events = newValue;
    this.eventsWatching = this.eventsWatching.filter((e) => e !== event);
  }

  public close(): void {
    this.watcher.close();
  }
}

export default FileMonitor;
