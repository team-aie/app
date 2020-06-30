import { Notification, OpenExternalOptions, shell } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import { AppUpdater } from 'electron-updater/out/AppUpdater';

interface AutoUpdater {
  /**
   * Check for application updates. If there are updates, update the app.
   * The behavior of updating and not updating the app (when there are no updates) is implementation-specific.
   * Note that having no updates available should not throw errors.
   */
  beginUpdate(): void;
}

interface ExternalLinkOpener {
  openExternal(url: string, options?: OpenExternalOptions): Promise<void>;
}

/**
 * The implementation using electron-updater to update the app
 * Exporting for testing purposes
 */
export class ElectronUpdater implements AutoUpdater {
  constructor(
    private updater: AppUpdater,
    private platform: NodeJS.Platform,
    private notificationConstructor: typeof Notification,
    private linkOpener: ExternalLinkOpener,
  ) {
    updater.logger = log;
  }

  beginUpdate(): void {
    log.debug('Start checking for updates');
    this.updater.on('checking-for-update', () => {
      log.debug('Checking for update');
    });
    this.updater.on('update-not-available', (info) => {
      log.debug('Update not available', info);
    });
    this.updater.on('error', (err) => {
      log.error('Error in auto-updater', err);
    });

    if (this.isSelfUpdatePossible()) {
      this.updater.on('update-available', (info) => {
        log.debug('Update available', info);
      });
      this.updater.checkForUpdatesAndNotify();
    } else {
      this.updater.autoDownload = false;
      this.updater.on('update-available', (info) => {
        log.debug('Update available', info);
        new this.notificationConstructor({
          title: 'Update available',
          subtitle: `${info.version} is available`,
          body: 'Please manually download and install the update due to macOS restrictions',
        })
          .on('click', () => this.linkOpener.openExternal('https://github.com/team-aie/app/releases'))
          .show();
      });
      this.updater.checkForUpdates();
    }
  }

  /**
   * Currently, since there are no app signing, we can only update Windows/Linux
   */
  private isSelfUpdatePossible(): boolean {
    /**
     * "darwin" is the codename for macOS
     */
    return this.platform !== 'darwin';
  }
}

export default new ElectronUpdater(autoUpdater, process.platform, Notification, shell);
