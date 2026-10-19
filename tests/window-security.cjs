const assert=require('node:assert/strict');const {EventEmitter}=require('node:events');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');
const file=path.join(__dirname,'../src/main/window-security.ts');const instance=new Module(file,module);let enabled;
instance.require=name=>name==='electron'?{app:{getAppPath:()=>'/fixture'}}:name==='@electron/remote/main'?{enable:contents=>enabled=contents}:require(name);
instance._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
const contents=new EventEmitter();let openHandler,permission;
contents.setWindowOpenHandler=f=>openHandler=f;contents.session={setPermissionRequestHandler:f=>permission=f};
instance.exports.secureLocalWindow({webContents:contents},'app');assert.equal(enabled,contents);assert.equal(openHandler({url:'https://example.com'}).action,'deny');
for(const eventName of ['will-navigate','will-redirect']) {
 for(const url of ['https://example.com','file:///etc/passwd','file:///fixture/build/menu.html','javascript:alert(1)']) {
  let prevented=false;contents.emit(eventName,{preventDefault:()=>prevented=true},url);assert.ok(prevented,`${eventName} blocks ${url}`);
 }
 let prevented=false;contents.emit(eventName,{preventDefault:()=>prevented=true},'file:///fixture/build/app.html');assert.equal(prevented,false);
}
let prevented=false;contents.emit('will-attach-webview',{preventDefault:()=>prevented=true});assert.ok(prevented);
permission(contents,'media',allowed=>assert.equal(allowed,false));console.log('Privileged windows: exact local URL only, external redirects/popups/webviews/permissions blocked');
