import chokidar from 'chokidar';
import { Subject } from 'rxjs';

class FileMonitor {
  folderPath: string;
  events: Array<string>;
  watcher: chokidar.FSWatcher;
  subject: any;
  constructor(folderPath: string) {
    this.subject = new Subject();
    this.folderPath = folderPath;
    this.events = [];
    this.watcher = chokidar.watch(this.folderPath, {
      ignored: /(^|[/\\])\../,
      followSymlinks: false,
      persistent: true,
    });
  }

  //Input: array of events
  //List of possible events:
  //unlink: files being deleted
  //change: files being changed
  //add: files being added
  //error: error occured
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  UNSAFE_componentWillMount() {
    this.watch = this.watch.bind(this);
  }
  public watch(events: Array<string>): void {
    this.events.push(...events);
    if (this.events.includes('unlink')) {
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
    if (this.events.includes('add')) {
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
    if (this.events.includes('change')) {
      this.watcher.on('change', (path) => alert(`File ${path} has been changed`));
    }
    if (this.events.includes('error')) {
      this.watcher.on('error', (error) => alert(`Error happened ${error}`));
    }
  }
  public close(): void {
    this.watcher.close();
  }
}

export default FileMonitor;
