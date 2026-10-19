// Run with Electron and a disposable HOME; never touches the user's ~/.multrin.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const {app,BrowserWindow,systemPreferences} = require('electron');
const root=path.join(__dirname,'..');app.setAppPath(root);
const home=require('node:os').homedir();
if(!home.includes('multrin-smoke-')) throw new Error('GUI smoke requires a disposable multrin-smoke- HOME');
fs.mkdirSync(path.join(home,'.multrin'),{recursive:true});
fs.writeFileSync(path.join(home,'.multrin/settings.json'),JSON.stringify({dark:true,fixture:'keep'}));
const errors=[];const created=[];
app.on('browser-window-created',(_e,window)=>{created.push(window);console.log('Created',window.id);window.on('closed',()=>console.log('Closed window'));});
app.on('web-contents-created',(_e,contents)=>{
 contents.on('render-process-gone',(_e,details)=>errors.push(details.reason));
 contents.on('preload-error',(_e,_file,error)=>errors.push(error.message));
 contents.on('console-message',details=>{if(details.level==='error')errors.push(details.message);});
});
require('../build/main.bundle.js');
const timeout=setTimeout(()=>{console.error('GUI smoke timeout');app.exit(1);},30000);
app.whenReady().then(async()=>{
 for(let attempt=0;attempt<100 && created.length<2;attempt++) await new Promise(r=>setTimeout(r,50));
 const windows=created.filter(w=>!w.isDestroyed());
 console.log('GUI windows',windows.map(w=>({id:w.id,url:w.webContents.getURL(),parent:w.getParentWindow()?.id})));
 const main=windows.find(w=>!w.getParentWindow());
 await new Promise((resolve,reject)=>{if(!main.webContents.isLoading())return resolve();main.webContents.once('did-finish-load',resolve);main.webContents.once('did-fail-load',(_e,_code,text)=>reject(Error(text)));});
 await new Promise(r=>setTimeout(r,750));
 const state=await main.webContents.executeJavaScript(`({text:document.body.innerText,settings:require('electron').ipcRenderer.sendSync('get-settings'),remoteId:require('@electron/remote').getCurrentWindow().id})`);
 assert.ok(state.text.includes('Drop windows here'),JSON.stringify(state));assert.equal(state.settings.dark,true);assert.equal(state.settings.fixture,'keep');assert.equal(state.remoteId,main.id);
 let nativeMouseEvents=[];
 if(process.platform==='darwin' && process.env.MULTRIN_SMOKE_NATIVE_MOUSE==='1') {
   const ts=require('typescript'),Module=require('node:module');
   const source=path.join(root,'src/main/input-hook.ts');const moduleInstance=new Module(source,module);moduleInstance.filename=source;moduleInstance.paths=module.paths;
   moduleInstance._compile(ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,source);
   const hook=moduleInstance.exports.createInputHook(require('uiohook-napi').uIOhook);
   for(const name of ['mousedown','mousedrag','mouseup'])hook.on(name,event=>nativeMouseEvents.push({type:name,x:event.x,y:event.y}));
   main.focus();const bounds=main.getBounds();
   await new Promise((resolve,reject)=>require('node:child_process').execFile('/usr/bin/swift',[path.join(__dirname,'native-mouse.swift'),String(bounds.x+200),String(bounds.y+250)],{timeout:30000},error=>error?reject(error):resolve()));
   await new Promise(r=>setTimeout(r,300));
   const down=nativeMouseEvents.findIndex(event=>event.type==='mousedown' && Math.abs(event.x-(bounds.x+200))<=1 && Math.abs(event.y-(bounds.y+250))<=1);
   const drag=nativeMouseEvents.findIndex((event,index)=>index>down && event.type==='mousedrag' && Math.abs(event.x-(bounds.x+210))<=1);
   const up=nativeMouseEvents.findIndex((event,index)=>index>drag && event.type==='mouseup' && Math.abs(event.x-(bounds.x+210))<=1);
   assert.ok(down>=0 && drag>down && up>drag,JSON.stringify({bounds,nativeMouseEvents}));
   nativeMouseEvents=nativeMouseEvents.slice(down,up+1);
   hook.removeAllListeners();
 }
 const output=process.env.MULTRIN_SMOKE_OUTPUT;if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'gui-main.png'),(await main.webContents.capturePage()).toPNG());}
 const popup=windows.find(w=>w.getParentWindow());popup.show();await new Promise(r=>setTimeout(r,200));
 const menuText=await popup.webContents.executeJavaScript('document.body.innerText');assert.ok(menuText.length>0);
 if(output)fs.writeFileSync(path.join(output,'gui-menu.png'),(await popup.webContents.capturePage()).toPNG());
 const blocked=await main.webContents.executeJavaScript(`window.open('https://example.invalid') === null`);assert.equal(blocked,true);
 const result={electron:process.versions.electron,node:process.versions.node,arch:process.arch,mainRendered:true,menuRendered:true,nativeMouseEvents:[...nativeMouseEvents],remoteWindow:true,settingsPreserved:state.settings,externalPopupBlocked:true,nativeWindowCount:require('node-window-manager').windowManager.getWindows().length,iconBytes:require('extract-file-icon')(process.execPath,16).length,accessibility:process.platform==='darwin'?systemPreferences.isTrustedAccessibilityClient(false):null,errors};
 assert.deepEqual(errors,[]);assert.equal(JSON.parse(fs.readFileSync(path.join(home,'.multrin/settings.json'))).fixture,'keep');
 if(output)fs.writeFileSync(path.join(output,'gui-smoke.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));clearTimeout(timeout);
 for(const window of created) if(!window.isDestroyed()) window.close();
 app.quit();
}).catch(error=>{console.error(error);clearTimeout(timeout);
 require('uiohook-napi').uIOhook.stop();
 for(const window of created) if(!window.isDestroyed()) window.close();
 setTimeout(()=>app.exit(1),100);
});
