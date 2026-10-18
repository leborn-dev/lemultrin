const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const Vibrant = require('node-vibrant');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAK0lEQVR4nO3OIQEAAAwEoetfeovxBoGnq1tKQEBAQEBAQEBAQEBAQEBgHXhUDfhqRFDd3gAAAABJRU5ErkJggg==', 'base64');
function loadPalette() {
  if (process.env.TEST_UNGUARDED_PALETTE) return icon => Vibrant.from(icon).getPalette();
  const file = path.join(__dirname, '../src/main/icon-palette.ts');
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018}
  }).outputText;
  const instance = new Module(file, module);
  instance.filename = file;
  instance.paths = Module._nodeModulePaths(path.dirname(file));
  instance._compile(compiled, file);
  return instance.exports.getIconPalette;
}
(async () => {
  const getPalette = loadPalette();
  const originalFrom = Vibrant.from;
  let calls = 0;
  Vibrant.from = () => { calls++; return {getPalette: () => Promise.resolve({unexpected: true})}; };
  try {
    const asfHeader = Buffer.from('3026b2758e66cf11a6d900aa0062ce6c', 'hex');
    for (const input of [null, undefined, '', 'https://example.invalid/icon.png', Buffer.alloc(0),
      Buffer.from('not a PNG'), png.slice(0, 7), png.slice(0, 33), png.slice(0, -1),
      Buffer.concat([png.slice(0, 8), Buffer.alloc(40)]), asfHeader]) {
      assert.equal(await getPalette(input), null, 'non-PNG input is skipped');
    }
    assert.equal(calls, 0, 'non-PNG and ASF bytes never enter the format-sniffing parser');
  } finally { Vibrant.from = originalFrom; }
  const palette = await getPalette(png);
  assert.ok(palette && palette.Vibrant, 'real file-icon-shaped PNG has a vibrant swatch');
  const rgb = palette.Vibrant.rgb;
  assert.ok(rgb[0] > 200 && rgb[1] < 40 && rgb[2] < 40, 'red icon remains red');
  // Exercise the real prepareContainer method, isolating only native window APIs.
  const appFile = path.join(__dirname, '../src/main/windows/app.ts');
  const appSource = ts.transpileModule(fs.readFileSync(appFile, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018}
  }).outputText;
  const appModule = new Module(appFile, module);
  let fileIcon = png;
  appModule.require = name => {
    if (name === 'electron') return {BrowserWindow: class {}};
    if (name === 'path' || name === 'os') return require(name);
    if (name === '../container') return {Container: class {constructor() {this.id = 7;}}};
    if (name === '../icon-palette') return {getIconPalette: getPalette};
    if (name === 'extract-file-icon') return () => fileIcon;
    return {};
  };
  appModule._compile(appSource, appFile);
  const app = Object.create(appModule.exports.AppWindow.prototype);
  const events = [];
  let background;
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('app did not emit PNG palette')), 5000);
    background = value => { clearTimeout(timeout); resolve(value); };
  });
  app.webContents = {send: (...event) => {events.push(event); if (event[0] === 'tab-background') background(event[2]);}};
  const window = {path: 'local-fixture', getTitle: () => 'Fixture'};
  assert.equal(app.prepareContainer(window).id, 7);
  assert.ok(/^#[a-f0-9]{6}$/i.test(await ready), 'real app call site emits computed PNG color');
  assert.strictEqual(events[0][1].icon, png, 'tab icon payload is unchanged');
  fileIcon = Buffer.from('3026b2758e66cf11a6d900aa0062ce6c', 'hex');
  events.length = 0;
  Vibrant.from = () => { calls++; throw new Error('ASF reached parser'); };
  try {
    app.prepareContainer(window);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 0, 'real app call site blocks ASF before parser');
    assert.equal(events.length, 1, 'invalid palette input still creates its tab');
    assert.equal(events[0][0], 'add-tab');
    assert.strictEqual(events[0][1].icon, fileIcon, 'tab icon display payload is preserved');
  } finally { Vibrant.from = originalFrom; }
  console.log(JSON.stringify({nonPngParserCalls: calls, appCallSite: true, png: {width: 32, height: 32, vibrantRgb: rgb}}));
})().catch(error => { console.error(error); process.exitCode = 1; });
