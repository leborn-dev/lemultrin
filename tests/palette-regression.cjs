const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const Module = require('node:module');
const ts = require('typescript'); const {PNG} = require('pngjs');
const file = path.join(__dirname, '../src/main/icon-palette.ts');
const instance = new Module(file,module); instance.filename=file; instance.paths=Module._nodeModulePaths(path.dirname(file));
instance._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const palette = instance.exports.getIconPalette;
function icon(w,h,color) { const image=new PNG({width:w,height:h}); for(let i=0;i<image.data.length;i+=4) image.data.set(color,i); return PNG.sync.write(image); }
(async()=>{
 const real=await palette(fs.readFileSync(path.join(__dirname,'fixtures/executable-icon.png')));
 assert.equal(real.Vibrant.hex,'#639b7f','native executable icon preserves its legacy Vibrant color');
 const tiny=await palette(icon(1,1,[255,0,0,255]));
 assert.ok(tiny && tiny.Vibrant, 'single opaque pixel must retain a tab color');
 assert.ok(tiny.Vibrant.rgb[0]>200 && tiny.Vibrant.rgb[1]<40);
 assert.equal(await palette(icon(16,16,[255,0,0,0])),null,'fully transparent icons have no visible palette');
 for(const [color,channel] of [[[255,0,0,255],0],[[0,255,0,255],1],[[0,0,255,255],2]]) {
  const swatch=(await palette(icon(32,32,color))).Vibrant;
  assert.ok(swatch.rgb[channel]>200); assert.match(swatch.hex,/^#[a-f0-9]{6}$/i);
 }
 const broken=icon(16,16,[20,50,250,255]); broken[45]^=255;
 assert.equal(await palette(broken),null,'invalid CRC must fail closed without crashing');
 assert.equal(await palette(Buffer.from('3026b2758e66cf11a6d900aa0062ce6c','hex')),null);
 console.log('PNG palette: single pixel, RGB, alpha, CRC, ASF cases passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
