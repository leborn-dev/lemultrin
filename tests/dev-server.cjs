const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const file=path.join(__dirname,'../scripts/dev-server.cjs');
assert.ok(fs.existsSync(file),'local development server exists');
const {createDevServer}=require(file);
(async()=>{
const root=fs.mkdtempSync(path.join(os.tmpdir(),'multrin-dev-'));fs.writeFileSync(path.join(root,'app.html'),'<h1>Multrin</h1>');const outside=fs.mkdtempSync(path.join(os.tmpdir(),'multrin-outside-'));fs.writeFileSync(path.join(outside,'secret.html'),'outside');fs.symlinkSync(outside,path.join(root,'escape'),process.platform==='win32'?'junction':'dir');
const server=createDevServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const address=`http://127.0.0.1:${server.address().port}`;
try{
 const response=await fetch(address+'/app.html');assert.equal(response.status,200);assert.equal(await response.text(),'<h1>Multrin</h1>');
 for(const file of ['escape/secret.html','%2e%2e%2fpackage.json','no-file.html']) assert.ok((await fetch(address+'/'+file)).status>=400,file);
 const status=await new Promise((resolve,reject)=>require('node:http').get(address+'/app.html',{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject));
 assert.equal(status,403);
 assert.equal((await fetch(address+'/app.html',{method:'POST'})).status,405);
 console.log('Dev server: local assets, traversal/symlink escapes, DNS rebinding, methods checked');
}finally{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true});fs.rmSync(outside,{recursive:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
