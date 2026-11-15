import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, nativeImage, shell, type NativeImage } from 'electron';
import electronUpdater from 'electron-updater';
import { broadcastUpdateStatus, registerIpc } from './ipc/register-ipc';
import { createDomainServices } from './ipc/domain-services-adapter';
import { createAppStateStore, APP_STATE_FILE_NAME } from './services/app-state';
import { createAudioStorage } from './services/audio-storage';
import { initDiagnostics, isDebugLaunch } from './services/diagnostics';
import { createShellHandoff, parseSafeExternalUrl } from './services/shell-handoff';
import { createUpdater, type AutoUpdaterLike } from './services/updater';

let mainWindow: BrowserWindow | null = null;

function resolveAppIcon(): NativeImage | undefined {
  const candidates = [
    path.join(process.resourcesPath, 'icon.png'),
    path.join(import.meta.dirname, '../../resources/icon.png'),
    path.join(import.meta.dirname, '../../build/icon.png')
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const icon = nativeImage.createFromPath(candidate);
        if (!icon.isEmpty()) return icon;
      }
    } catch {
      // Try next icon candidate.
    }
  }
  return undefined;
}

function createMainWindow(openDevTools: boolean, windowIcon?: NativeImage): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 660,
    title: 'aie',
    backgroundColor: '#0b0d12',
    ...(windowIcon && process.platform !== 'darwin' ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Never let the renderer navigate away or spawn windows; web links go to the OS browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      void shell.openExternal(parseSafeExternalUrl(url).toString());
    } catch {
      // blocked scheme
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
    if (!(rendererUrl && url.startsWith(rendererUrl)) && !url.startsWith('file://')) event.preventDefault();
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) void win.loadURL(rendererUrl);
  else void win.loadFile(path.join(import.meta.dirname, '../renderer/index.html'));

  if (openDevTools) win.webContents.once('did-finish-load', () => win.webContents.openDevTools({ mode: 'detach' }));
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  return win;
}

const customUserDataDir = process.env['AIE_USER_DATA_DIR'];
if (customUserDataDir) {
  app.setPath('userData', path.resolve(customUserDataDir));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    const appState = createAppStateStore({
      filePath: path.join(app.getPath('userData'), APP_STATE_FILE_NAME),
      systemLocale: app.getLocale()
    });
    const diagnostics = initDiagnostics({
      getSettings: () => appState.getSettings(),
      getMainWindow: () => mainWindow
    });
    const log = diagnostics.logger;
    log.info(`aie ${app.getVersion()} starting (${process.platform}-${process.arch})`);

    const trashItem = (target: string): Promise<void> => shell.trashItem(target);
    const shellHandoff = createShellHandoff({ shell, getSettings: () => appState.getSettings() });
    const updater = createUpdater({
      currentVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      loadAutoUpdater: () => electronUpdater.autoUpdater as unknown as AutoUpdaterLike,
      openExternalUrl: (url) => shellHandoff.openExternalUrl(url),
      onStatus: broadcastUpdateStatus,
      logger: log
    });

    const disposeIpc = registerIpc({
      appState,
      domain: createDomainServices({ trashItem }),
      audioStorage: createAudioStorage({ trashItem }),
      diagnostics,
      shellHandoff,
      updater,
      getMainWindow: () => mainWindow,
      logger: log
    });
    app.once('will-quit', () => {
      disposeIpc();
      void appState.flush();
    });

    const windowIcon = resolveAppIcon();
    if (
      process.platform === 'darwin' &&
      !app.isPackaged &&
      !process.env['CI'] &&
      !process.env['AIE_USER_DATA_DIR'] &&
      windowIcon
    ) {
      try {
        app.dock?.setIcon(windowIcon);
      } catch {
        // Ignore in headless/non-GUI environments where Dock is unavailable.
      }
    }

    mainWindow = createMainWindow(isDebugLaunch(), windowIcon);
    if (app.isPackaged) setTimeout(() => void updater.checkForUpdates(), 5000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow(isDebugLaunch(), windowIcon);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
