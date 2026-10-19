const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const Module = require('node:module');
const ts = require('typescript');
const file = path.join(__dirname, '../src/main/window-security.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS},
}).outputText;

// Exercise both URL formats on every host: Windows drive letters and encoded
// spaces must be accepted only for the exact bundled document.
for (const windows of [false, true]) {
  const paths = windows ? path.win32 : path.posix;
  const appPath = windows ? String.raw`C:\fixture app\Resources\app.asar` : '/fixture app/Resources/app.asar';
  const fileURL = value => pathToFileURL(value, {windows});
  const allowed = fileURL(paths.join(appPath, 'build/app.html')).href;
  const instance = new Module(file, module);
  let enabled;
  instance.require = name => name === 'electron' ? {app:{getAppPath:() => appPath}}
    : name === '@electron/remote/main' ? {enable:contents => enabled = contents}
    : name === 'path' ? paths : name === 'url' ? {pathToFileURL:fileURL} : require(name);
  instance._compile(compiled, file);
  const contents = new EventEmitter();
  let openHandler, permission;
  contents.setWindowOpenHandler = handler => openHandler = handler;
  contents.session = {setPermissionRequestHandler:handler => permission = handler};
  instance.exports.secureLocalWindow({webContents:contents}, 'app');
  assert.equal(enabled, contents);
  assert.equal(openHandler({url:'https://example.com'}).action, 'deny');
  for (const eventName of ['will-navigate', 'will-redirect']) {
    for (const url of ['https://example.com', 'file:///etc/passwd',
      fileURL(paths.join(appPath, 'build/menu.html')).href, 'javascript:alert(1)', allowed + '?foreign']) {
      let prevented = false;
      contents.emit(eventName, {preventDefault:() => prevented = true}, url);
      assert.ok(prevented, `${eventName} blocks ${url}`);
    }
    let prevented = false;
    contents.emit(eventName, {preventDefault:() => prevented = true}, allowed);
    assert.equal(prevented, false, `canonical ${windows ? 'Windows' : 'POSIX'} packaged URL is allowed`);
  }
  let prevented = false;
  contents.emit('will-attach-webview', {preventDefault:() => prevented = true});
  assert.ok(prevented);
  permission(contents, 'media', permitted => assert.equal(permitted, false));
}
console.log('Privileged windows: Windows/POSIX packaged URLs, external redirects/popups/webviews/permissions blocked');
