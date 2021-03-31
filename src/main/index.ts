import * as path from 'path';
import { format as formatUrl } from 'url';

import { initialize as electronRemoteInitialize } from '@electron/remote/dist/src/main';
import { BrowserWindow, Menu, MenuItemConstructorOptions, app, shell } from 'electron';
import log from 'electron-log';

import { RETAINED_LOCALSTORAGE_KEYS } from '../common/env-and-consts';
import { AssertionError } from '../common/errors';

import autoUpdater from './auto-updater';

const isDevelopment = process.env.NODE_ENV !== 'production';

const isFirstInstance = app.requestSingleInstanceLock();

if (!isFirstInstance) {
  app.quit();
} else {
  const initializeOrHideMenuBar = (window: BrowserWindow, platform: NodeJS.Platform): void => {
    if (platform === 'linux' || platform === 'win32') {
      // We simply don't need the menu in this case
      Menu.setApplicationMenu(null);
      return;
    } else {
      /**
       * This will follow Electron built-in menus.
       * Currently following {@link https://www.electronjs.org/docs/api/menu#main-process}
       */
      const template: MenuItemConstructorOptions[] = [
        { role: 'appMenu' },
        { role: 'fileMenu' },
        { role: 'editMenu' },
        {
          role: 'viewMenu',
          submenu: [
            ...(isDevelopment
              ? [
                  { role: 'reload' } as MenuItemConstructorOptions,
                  { role: 'forceReload' } as MenuItemConstructorOptions,
                  { role: 'toggleDevTools' } as MenuItemConstructorOptions,
                  { type: 'separator' } as MenuItemConstructorOptions,
                  { role: 'resetZoom' } as MenuItemConstructorOptions,
                  { role: 'zoomIn' } as MenuItemConstructorOptions,
                  { role: 'zoomOut' } as MenuItemConstructorOptions,
                  { type: 'separator' } as MenuItemConstructorOptions,
                ]
              : []),
            { role: 'togglefullscreen' },
          ],
        },
        { role: 'windowMenu' },
        {
          role: 'help',
          submenu: [
            {
              label: 'Home Page',
              click: (): void => {
                shell.openExternal('https://github.com/team-aie/app#readme');
              },
            },
            {
              label: 'Bugs and Issues',
              click: (): void => {
                shell.openExternal('https://github.com/team-aie/app/issues');
              },
            },
            {
              label: 'Latest Releases',
              click: (): void => {
                shell.openExternal('https://github.com/team-aie/app/releases');
              },
            },
          ],
        },
      ];
      log.debug('Menu bar template', template);
      log.debug('Menu bar template JSON', JSON.stringify(template, null, 2));
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
  };

  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  let mainWindow: BrowserWindow | null;
  // Tracks whether the user has initiated quitting on macOS.
  let quitting = false;

  const createWindow = (): void => {
    // Create the browser window.
    const osPlatform = process.platform;
    log.info('Platform:', osPlatform);
    log.info('isDevelopment:', isDevelopment);
    const newWindow = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 400,
      minHeight: 300,
      webPreferences: {
        contextIsolation: false,
        defaultEncoding: 'UTF-8',
        enableRemoteModule: true,
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        worldSafeExecuteJavaScript: true,
      },
    });

    initializeOrHideMenuBar(newWindow, osPlatform);

    if (isDevelopment) {
      newWindow.webContents.openDevTools({
        mode: 'undocked',
      });
    }

    if (isDevelopment) {
      newWindow.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`);
    } else {
      newWindow.loadURL(
        formatUrl({
          pathname: path.join(__dirname, 'index.html'),
          protocol: 'file',
          slashes: true,
        }),
      );
    }

    newWindow.on('close', (e) => {
      if (process.platform === 'darwin' && !quitting) {
        e.preventDefault();
        newWindow.hide();
      }
    });

    // Emitted when the window is closed.
    newWindow.on('closed', () => {
      if (mainWindow === newWindow) {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
      }
    });

    mainWindow = newWindow;
  };

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', () => {
    log.info('App ready');
    createWindow();
    log.info('Local storage is cleaned on session creation except variables stored in RETAINED_LOCALSTORAGE_KEYS.');
    (async (): Promise<void> => {
      if (mainWindow) {
        const retrievedStorage = await mainWindow.webContents.executeJavaScript('({...localStorage});');
        const reservedStateValues = RETAINED_LOCALSTORAGE_KEYS.map((state) => retrievedStorage[state]);
        await mainWindow.webContents.session.clearStorageData({ storages: ['localstorage'] });
        log.info('clearStorageData is done!');
        for (let index = 0; index < RETAINED_LOCALSTORAGE_KEYS.length; index++) {
          mainWindow.webContents.executeJavaScript(
            `localStorage.setItem(${JSON.stringify(RETAINED_LOCALSTORAGE_KEYS[index])},${JSON.stringify(
              reservedStateValues[index],
            )});`,
          );
        }
      }
    })();

    app.on('ready', () => {
      log.info('App ready');
      createWindow();
      log.info('Cleaning local storage on session creation');
      if (mainWindow) {
        mainWindow.webContents.session.clearStorageData({ storages: ['localstorage'] }).catch(log.error);
      }
      if (!isDevelopment) {
        autoUpdater.beginUpdate();
      }
    });

    if (!isDevelopment) {
      autoUpdater.beginUpdate();
    }
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar to stay active until the user quits explicitly with Cmd
    // + Q.
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      throw new AssertionError('Main window will never be null');
    } else {
      mainWindow.show();
    }
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  /**
   * If the user is trying to open another instance, we should focus the main window instead.
   * See {@link https://www.electronjs.org/docs/api/app#apprequestsingleinstancelock}
   */
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  electronRemoteInitialize();
  // For Windows notifications. See https://www.electronjs.org/docs/tutorial/notifications#windows.
  // But need to use appId here. See https://www.electron.build/configuration/nsis.html#guid-vs-application-name.
  // Requiring the builder config file ensures the `appId` stays in sync.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  app.setAppUserModelId(require('../../electron-builder').appId);

  if (module.hot) {
    module.hot.accept();
  }
}
