// Because this is for fixing the type definition of @electron/remote.
/* eslint-disable @typescript-eslint/no-explicit-any,no-var */

/**
 * This file is needed to temporarily solve compilation errors for `@electron/remote`.
 *
 * TODO: Remove this file after their type declarations are fixed.
 * See also: https://github.com/electron/remote/issues/85#issuecomment-966671757,
 * https://github.com/microsoft/TypeScript/issues/17042#issuecomment-327882577.
 */

// Taken from RemoteMainInterface
export var app: Electron.App;
export var autoUpdater: Electron.AutoUpdater;
export var BrowserView: typeof Electron.BrowserView;
export var BrowserWindow: typeof Electron.BrowserWindow;
export var ClientRequest: Electron.ClientRequest;
export var clipboard: Electron.Clipboard;
export var CommandLine: Electron.CommandLine;
export var contentTracing: Electron.ContentTracing;
export var Cookies: Electron.Cookies;
export var crashReporter: Electron.CrashReporter;
export var Debugger: Electron.Debugger;
export var desktopCapturer: Electron.DesktopCapturer;
export var dialog: Electron.Dialog;
export var Dock: Electron.Dock;
export var DownloadItem: Electron.DownloadItem;
export var globalShortcut: Electron.GlobalShortcut;
export var inAppPurchase: Electron.InAppPurchase;
export var IncomingMessage: Electron.IncomingMessage;
export var ipcMain: Electron.IpcMain;
export var Menu: typeof Electron.Menu;
export var MenuItem: typeof Electron.MenuItem;
export var MessageChannelMain: typeof Electron.MessageChannelMain;
export var MessagePortMain: Electron.MessagePortMain;
export var nativeImage: typeof Electron.nativeImage;
export var nativeTheme: Electron.NativeTheme;
export var net: Electron.Net;
export var netLog: Electron.NetLog;
export var Notification: typeof Electron.Notification;
export var powerMonitor: Electron.PowerMonitor;
export var powerSaveBlocker: Electron.PowerSaveBlocker;
export var protocol: Electron.Protocol;
export var screen: Electron.Screen;
export var ServiceWorkers: Electron.ServiceWorkers;
export var session: typeof Electron.session;
export var shell: Electron.Shell;
export var systemPreferences: Electron.SystemPreferences;
export var TouchBar: typeof Electron.TouchBar;
export var TouchBarButton: Electron.TouchBarButton;
export var TouchBarColorPicker: Electron.TouchBarColorPicker;
export var TouchBarGroup: Electron.TouchBarGroup;
export var TouchBarLabel: Electron.TouchBarLabel;
export var TouchBarOtherItemsProxy: Electron.TouchBarOtherItemsProxy;
export var TouchBarPopover: Electron.TouchBarPopover;
export var TouchBarScrubber: Electron.TouchBarScrubber;
export var TouchBarSegmentedControl: Electron.TouchBarSegmentedControl;
export var TouchBarSlider: Electron.TouchBarSlider;
export var TouchBarSpacer: Electron.TouchBarSpacer;
export var Tray: typeof Electron.Tray;
export var webContents: typeof Electron.webContents;
export var WebRequest: Electron.WebRequest;

// Taken from Remote
export function getCurrentWebContents(): Electron.WebContents;
export function getCurrentWindow(): Electron.BrowserWindow;
export function getGlobal(name: string): any;
export var process: NodeJS.Process;
export var require: NodeJS.Require;
