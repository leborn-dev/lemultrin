const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const {EventEmitter}=require('node:events');const ts=require('typescript');
const input=new EventEmitter(),manager=new EventEmitter(),ipc=new EventEmitter();manager.requestAccessibility=()=>{};
const file=path.join(__dirname,'../src/main/windows/app.ts');const instance=new Module(file,module);
instance.require=name=>name==='electron'?{BrowserWindow:EventEmitter,ipcMain:ipc}:name==='node-window-manager'?{windowManager:manager,Window:class{}}:name==='..'?{iohook:input}:name==='os'||name==='path'?require(name):{};
instance._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const prototype=instance.exports.AppWindow.prototype;const window=new EventEmitter();Object.setPrototypeOf(window,prototype);window.id=7;window.getHandle=()=>1;window.intervalCallback=()=>{};window.isDestroyed=()=>true;window.isMinimized=()=>{throw Error('native API called on destroyed window');};
assert.doesNotThrow(()=>window.mouseDragWindow({}), 'late drag must not touch destroyed window');
window.activateWindowCapturing();
try{assert.equal(input.listenerCount('mousedown'),1);assert.ok(ipc.eventNames().length>0);window.emit('closed');assert.equal(input.eventNames().length,0,'native input handlers removed');assert.equal(manager.eventNames().length,0,'window activation handler removed');assert.equal(ipc.eventNames().length,0,'IPC handlers removed');}finally{clearInterval(window.interval);}
console.log('Window lifecycle: late drag safe, native/window/IPC listeners released');
