import { ipcMain, app, Menu, webContents, systemPreferences } from 'electron';
import { resolve } from 'path';
import { platform, homedir } from 'os';
import { AppWindow } from './windows/app';
import { autoUpdater } from 'electron-updater';
import { Settings } from './settings';
import { createInputHook } from './input-hook';
import { uIOhook } from 'uiohook-napi';
import { initialize } from '@electron/remote/main';
initialize();

app.name = 'Multrin';

ipcMain.setMaxListeners(0);

app.setPath('userData', resolve(homedir(), '.multrin'));

export const appWindows: AppWindow[] = [];

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    if (appWindows.length > 0) {
      appWindows.push(new AppWindow());
    }
  });
}

export const settings = new Settings();

export const iohook = createInputHook(uIOhook);
let inputStarted = false;
let accessibilityPoll: ReturnType<typeof setInterval>;
app.on('will-quit', () => {
  clearInterval(accessibilityPoll);
  if (inputStarted) iohook.stop();
});

app.on('ready', () => {
  const startInput = () => {
    if (platform() === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(false)) return;
    if (!inputStarted) { iohook.start(); inputStarted = true; }
    clearInterval(accessibilityPoll);
  };
  // macOS must grant Accessibility before libuiohook can start safely.
  // Existing windowManager permission prompt runs when AppWindow is created.
  startInput();
  if (!inputStarted) accessibilityPoll = setInterval(startInput, 2000);

  // Create our menu entries so that we can use macOS shortcuts
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        role: 'editMenu',
        label: 'Edit',
      },
      {
        label: 'Other',
        submenu: [
          {
            accelerator: 'CmdOrCtrl+Shift+F12',
            label: 'Toggle developer tools (window)',
            visible: false,
            click() {
              webContents.getFocusedWebContents().openDevTools();
            },
          },
        ],
      },
    ]),
  );

  app.on('activate', () => {
    if (appWindows.length === 0) {
      appWindows.push(new AppWindow());
    }
  });

  appWindows.push(new AppWindow());

  autoUpdater.on('update-downloaded', ({ version }) => {
    for (const w of appWindows) {
      w.webContents.send('update-available', version);
    }
  });

  ipcMain.on('update-install', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.on('update-check', () => {
    autoUpdater.checkForUpdates();
  });
});

app.on('window-all-closed', () => {
  if (platform() !== 'darwin') {
    app.quit();
  }
});
