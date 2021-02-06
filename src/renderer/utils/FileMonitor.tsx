import chokidar from 'chokidar';

class FileMonitor {
  folderPath: string;
  ignoredArray: Array<string>;
  watcher: chokidar.FSWatcher;

  constructor(folderPath: string, ignoredArray: Array<string>) {
    this.folderPath = folderPath;
    this.ignoredArray = ignoredArray;
    this.watcher = chokidar.watch(this.folderPath, {
      ignored: [/(^|[/\\])\../, ...ignoredArray],
      followSymlinks: false,
      persistent: true,
    });
    this.watcher
      .on('add', (path) => console.log(`File ${path} has been added`))
      .on('unlink', (path) => alert(`File ${path} has been removed`))
      .on('addDir', (path) => console.log(`File ${path} has been added`))
      .on('unlinkDir', (path) => alert(`File ${path} has been removed`));
  }

  close() {
    this.watcher.close().then(() => {
      console.log('closed');
    });
  }
  // const log = console.log.bind(console);
}

export default FileMonitor;
