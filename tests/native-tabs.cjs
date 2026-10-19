// Real native windows owned by this smoke process; only title text is controlled
// at the ProcessWindow boundary so markup/XSS inputs do not depend on OS titles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const {BrowserWindow} = require('electron');
const {windowManager,addon} = require('node-window-manager');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function processWindowClass() {
  const file = path.join(__dirname, '../src/main/process-window.ts');
  const instance = new Module(file, module);
  instance.filename = file;
  instance.paths = Module._nodeModulePaths(path.dirname(file));
  instance.require = name => name === '.' ? {iohook:require('uiohook-napi').uIOhook} : require(name);
  instance._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText, file);
  return instance.exports.ProcessWindow;
}

async function runNativeTabs(main) {
  const ProcessWindow = processWindowClass();
  const fixtures = [];
  const windows = [];
  const titles = ['Fixture <img src=x onerror="window.smokeTitleXss=1">', 'Fixture second <svg onload="window.smokeTitleXss=1">'];
  for (let index = 0; index < 2; index++) {
    const fixture = new BrowserWindow({
      x:100 + index * 350,y:120,width:300,height:220,show:true,
      webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true},
    });
    fixtures.push(fixture);
    await fixture.loadURL('data:text/html,<title>Disposable smoke fixture</title><p>Owned native window</p>');
    fixture.setTitle(titles[index]);
    await pause(150);
    const bounds = fixture.getBounds();
    const native = windowManager.getWindows().find(window => {
      if (window.processId !== process.pid) return false;
      const candidate = window.getBounds();
      return Math.abs(candidate.x - bounds.x) <= 2 && Math.abs(candidate.y - bounds.y) <= 2 && Math.abs(candidate.width - bounds.width) <= 2;
    });
    assert.ok(native, 'disposable native fixture enumerated by process and geometry');
    const window = new ProcessWindow(native.id, main);
    window.getTitle = () => titles[index];
    windows.push(window);
    main.addTabWithWindow(window);
    await pause(650);
  }
  assert.equal(main.containers.length, 2);
  const dom = await main.webContents.executeJavaScript(`(() => {
    const titles=${JSON.stringify(titles)};
    const leaves=titles.map(text=>[...document.querySelectorAll('div')].find(node=>!node.children.length && node.textContent===text));
    return {text:document.body.textContent,unsafeNodes:document.querySelectorAll('img[src=x],svg[onload]').length,executed:!!window.smokeTitleXss,
      tabs:leaves.map(title=>title?({title:title.textContent,background:title.parentElement.parentElement.style.backgroundColor,
        icon:!!title.parentElement.querySelector('[style*="blob:"]'),width:title.parentElement.parentElement.getBoundingClientRect().width}):null)};
  })()`);
  assert.equal(dom.unsafeNodes, 0);
  assert.equal(dom.executed, false);
  assert.ok(dom.tabs.every(tab => tab && tab.icon && tab.width > 0), JSON.stringify(dom));
  const paletteFile=path.join(__dirname,'../src/main/icon-palette.ts');
  const paletteModule=new Module(paletteFile,module);paletteModule.filename=paletteFile;paletteModule.paths=Module._nodeModulePaths(path.dirname(paletteFile));
  paletteModule._compile(ts.transpileModule(fs.readFileSync(paletteFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,paletteFile);
  const palette=await paletteModule.exports.getIconPalette(require('extract-file-icon')(windows[1].path,16));
  assert.ok(palette?.Vibrant,'real native icon produces a palette');
  const colorFile=path.join(__dirname,'../src/renderer/views/app/utils/colors.ts');const colors=new Module(colorFile,module);
  colors._compile(ts.transpileModule(fs.readFileSync(colorFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,colorFile);
  const expectedColor=colors.exports.shadeBlendConvert(0.4,palette.Vibrant.hex,'#212121');
  const expectedRgb='rgb('+expectedColor.slice(1).match(/../g).map(pair=>parseInt(pair,16)).join(', ')+')';
  assert.equal(dom.tabs[1].background,expectedRgb,'real native icon palette is blended into selected tab');

  // Select through the renderer's real mousedown handler and IPC, then verify
  // native visibility and the main process selection both change.
  const select = async title => {
    // A synthetic DOM event does not activate its native window as a real user
    // click would. Focus only our owned app before exercising the handler.
    require('electron').app.focus({steal:true});
    main.focus();
    await pause(100);
    await main.webContents.executeJavaScript(`(() => {
      const leaf=[...document.querySelectorAll('div')].find(node=>!node.children.length && node.textContent===${JSON.stringify(title)});
      leaf.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:30}));
      window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    })()`);
    await pause(250);
  };
  const first = main.containers.find(container => container.windows[0].id === windows[0].id);
  const second = main.containers.find(container => container.windows[0].id === windows[1].id);
  await select(titles[0]);
  assert.equal(main.selectedContainer, first);
  assert.equal(windowManager.getActiveWindow().id,windows[0].id,'first selected native fixture is raised');
  if(addon.setWindowOpacity) {assert.equal(windows[0].getOpacity(),1);assert.equal(windows[1].getOpacity(),0);}
  await select(titles[1]);
  assert.equal(main.selectedContainer, second);
  assert.equal(windowManager.getActiveWindow().id,windows[1].id,'second selected native fixture is raised');
  if(addon.setWindowOpacity) {assert.equal(windows[0].getOpacity(),0);assert.equal(windows[1].getOpacity(),1);}
  const organized = windows[1].getBounds();
  const target = main.getContentArea();
  assert.ok(Math.abs(organized.x - target.x) <= 2 && Math.abs(organized.y - target.y) <= 2);

  titles[0] = 'Updated <script>window.smokeTitleXss=2</script>';
  fixtures[0].setTitle(titles[0]);
  await pause(350);
  const updated = await main.webContents.executeJavaScript(`({text:document.body.textContent,executed:!!window.smokeTitleXss,scriptPayload:[...document.scripts].some(script=>script.textContent.includes('smokeTitleXss=2'))})`);
  assert.ok(updated.text.includes(titles[0]));
  assert.equal(updated.executed, false);
  assert.equal(updated.scriptPayload, false);
  await select(titles[0]);
  return {fixtures,result:{twoTabs:true,rendererSelection:true,nativeSelection:true,opacityControl:!!addon.setWindowOpacity,nativeGeometry:{organized,target},titleMarkupEscaped:true,titleUpdate:true,iconAndColor:dom.tabs,nativeIconPalette:palette.Vibrant.hex}};
}
module.exports = {runNativeTabs};
