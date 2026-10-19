const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');const net=require('node:net');
(async()=>{
 if(process.argv.length>2) throw Error('Packaged smoke does not accept executable paths or other arguments');
 const {createSmokeContext,packagedExecutable}=require('./smoke-context.cjs');
 const binary=packagedExecutable();
 const context=createSmokeContext();
 const home=context.home;console.log('Smoke evidence: '+context.output);
 fs.mkdirSync(path.join(home,'.multrin'));fs.writeFileSync(path.join(home,'.multrin/settings.json'),JSON.stringify({dark:true,fixture:'packaged-keep'}));
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(binary,[`--remote-debugging-port=${port}`],{env:{...process.env,HOME:home,USERPROFILE:home},shell:false,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 let socket;
 try{
  let page;for(let attempt=0;attempt<200;attempt++){
   try{const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();page=pages.find(p=>p.url.endsWith('/app.asar/build/app.html'));if(page)break;}catch{}
   await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(page,'packaged app.asar URL loads');socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});let id=0;const pending=new Map();socket.onmessage=e=>{const message=JSON.parse(e.data);if(message.id){const wait=pending.get(message.id);pending.delete(message.id);message.error?wait.reject(message.error):wait.resolve(message.result);}};
  const command=(method,params={})=>new Promise((resolve,reject)=>{const current=++id;pending.set(current,{resolve,reject});socket.send(JSON.stringify({id:current,method,params}));});
  await new Promise(r=>setTimeout(r,500));
  const result=await command('Runtime.evaluate',{expression:`({url:location.href,text:document.body.innerText,electron:process.versions.electron,node:process.versions.node,settings:require('electron').ipcRenderer.sendSync('get-settings'),remoteId:require('@electron/remote').getCurrentWindow().id,externalPopupBlocked:window.open('https://example.invalid')===null,nativeWindowCount:require('node-window-manager').windowManager.getWindows().length})`,returnByValue:true});
  assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));const state=result.result.value;assert.ok(state.text.includes('Drop windows here'));assert.equal(state.settings.fixture,'packaged-keep');assert.equal(state.electron,'44.9.0');assert.ok(state.remoteId);assert.equal(state.externalPopupBlocked,true);assert.ok(state.nativeWindowCount>0);
  const screenshot=await command('Page.captureScreenshot',{format:'png'});
  context.writeEvidence('packaged-main.png',Buffer.from(screenshot.data,'base64'));
  context.writeEvidence('packaged-smoke.json',JSON.stringify(state,null,2)+'\n');
  console.log(JSON.stringify(state));
  await command('Runtime.evaluate',{expression:`require('@electron/remote').app.quit()`}).catch(()=>{});
 }finally{if(socket)socket.close();if(child.exitCode===null)child.kill('SIGTERM');context.writeEvidence('packaged-runtime.log',log);}
})().catch(e=>{console.error(e);process.exitCode=1;});
