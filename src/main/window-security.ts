import { app, BrowserWindow } from 'electron';
import { enable } from '@electron/remote/main';
import { join } from 'path';
import { pathToFileURL } from 'url';

// Legacy React views require Node integration and remote. Only the exact bundled
// document (or loopback development document) may occupy a privileged window.
export function secureLocalWindow(window: BrowserWindow, name: string) {
  const allowed = process.env.ENV === 'dev'
    ? `http://localhost:4444/${name}.html`
    : pathToFileURL(join(app.getAppPath(), `build/${name}.html`)).href;
  enable(window.webContents);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== allowed) event.preventDefault();
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (url !== allowed) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
}
