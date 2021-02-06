import chokidar from 'chokidar';

class FileMonitor {
  folderPath: string;
  watcher: chokidar.FSWatcher;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
    this.watcher = chokidar.watch(this.folderPath, {
      ignored: /(^|[/\\])\../,
      followSymlinks: false,
      persistent: true,
    });

    this.watcher
      .on('unlink', (path) => alert(`File ${path} has been removed`))
      .on('unlinkDir', (path) => alert(`File ${path} has been removed`));
  }

  close() {
    this.watcher.close();
    return;
  }
}

export default FileMonitor;
