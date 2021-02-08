import chokidar from 'chokidar';

class FileMonitor {
  folderPath: string;
  events: Array<string>;
  watcher: chokidar.FSWatcher;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
    this.events = [];
    this.watcher = chokidar.watch(this.folderPath, {
      ignored: /(^|[/\\])\../,
      followSymlinks: false,
      persistent: true,
    });
  }
  public watch(events: Array<string>): void {
    this.events.push(...events);
    if (this.events.includes('unlink')) {
      this.watcher
        .on('unlink', (path) => alert(`File ${path} has been removed`))
        .on('unlinkDir', (path) => alert(`File ${path} has been removed`));
    }
    if (this.events.includes('add')) {
      this.watcher
        .on('add', (path) => alert(`File ${path} has been added`))
        .on('addDir', (path) => alert(`File ${path} has been added`));
    }
    if (this.events.includes('change')) {
      this.watcher.on('change', (path) => alert(`File ${path} has been changed`));
    }
  }
  public close(): void {
    this.watcher.close();
  }
}

export default FileMonitor;
