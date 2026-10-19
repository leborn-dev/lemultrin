const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const Module = require('node:module');
const zlib = require('node:zlib'); const ts = require('typescript');
const {PNG} = require('pngjs'); const crc = require('pngjs/lib/crc');
const file = path.join(__dirname, '../src/main/icon-palette.ts');
const instance = new Module(file, module); instance.filename=file; instance.paths=Module._nodeModulePaths(path.dirname(file));
instance._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const getPalette = instance.exports.getIconPalette;
function chunk(type, data) {
  const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);result.write(type,4);data.copy(result,8);
  result.writeInt32BE(crc.crc32(result.subarray(4,-4)),result.length-4);return result;
}
function png(width,height,depth,type,interlace,raw,extra=[]) {
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=depth;header[9]=type;header[12]=interlace;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),...extra,chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const passes=[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]];
function adam7(width,height,color,depth=8) {
  const rows=[];
  for(const [x,y,dx,dy] of passes) for(let py=y;py<height && x<width;py+=dy) {
    const row=[0];for(let px=x;px<width;px+=dx) for(const value of color) depth===16?row.push(value,value):row.push(value);rows.push(Buffer.from(row));
  }
  return Buffer.concat(rows);
}
(async()=>{
  const calls=[];const original=zlib.inflateSync;
  zlib.inflateSync=(input,options)=>{
    const call={maxOutputLength:options?.maxOutputLength ?? null};calls.push(call);
    try{const raw=original(input,options);call.outputBytes=raw.length;return raw;}catch(error){call.error=error.code;throw error;}
  };
  try {
    const bomb=png(1,1,8,6,1,Buffer.alloc(16*1024*1024));
    assert.equal(await getPalette(bomb),null);
    assert.equal(calls[0].maxOutputLength,5,'1x1 Adam7 RGBA scanline budget includes one filter byte');
    assert.equal(calls[0].outputBytes,undefined,'oversized stream never materializes the 16 MiB output');
    assert.equal(calls[0].error,'ERR_BUFFER_TOO_LARGE');
    for(const [width,height,depth] of [[1,1,8],[9,11,8],[17,9,16],[512,512,16]]) {
      const raw=adam7(width,height,[255,0,0,255],depth);
      const result=await getPalette(png(width,height,depth,6,1,raw));
      assert.ok(result?.Vibrant && result.Vibrant.rgb[0]>200,'valid Adam7 red remains supported');
      assert.equal(calls.at(-1).maxOutputLength,raw.length,'exact per-pass bit-depth geometry budget');
      assert.equal(calls.at(-1).outputBytes,raw.length);
      if(width===512) assert.equal(raw.length,2098112,'maximum supported Adam7 geometry has a finite 2 MiB scanline budget');
    }
    const packedRows=[];
    for(const [x,y,dx,dy] of passes) for(let py=y;py<11 && x<9;py+=dy) {
      packedRows.push(Buffer.alloc(1+Math.ceil(Math.ceil((9-x)/dx)/8)));
    }
    const packed=Buffer.concat(packedRows);
    assert.ok((await getPalette(png(9,11,1,3,1,packed,[chunk('PLTE',Buffer.from([255,0,0,0,255,0]))])))?.Vibrant?.rgb[0]>200,'1-bit paletted Adam7 remains supported');
    assert.equal(calls.at(-1).maxOutputLength,packed.length);
    assert.ok(await getPalette(png(9,11,1,0,1,packed)),'1-bit grayscale Adam7 remains supported');
    assert.equal(calls.at(-1).maxOutputLength,packed.length);
    const beforeInvalid=calls.length;
    assert.equal(await getPalette(png(9,11,1,2,1,packed)),null,'invalid sample/color combination rejected');
    const duplicateHeader=Buffer.alloc(13);duplicateHeader.writeUInt32BE(512);duplicateHeader.writeUInt32BE(512,4);duplicateHeader[8]=16;duplicateHeader[9]=6;duplicateHeader[12]=1;
    assert.equal(await getPalette(png(1,1,8,6,1,Buffer.from([0,255,0,0,255]),[chunk('IHDR',duplicateHeader)])),null,'duplicate header cannot replace the geometry budget');
    assert.equal(calls.length,beforeInvalid,'invalid metadata never reaches inflate');
    for(const [type,samples] of [[2,[255,0,0]],[4,[80,255]],[0,[80]]]) {
      const raw=adam7(9,11,samples);
      assert.ok(await getPalette(png(9,11,8,type,1,raw)),'valid RGB/grayscale sample format remains supported');
      assert.equal(calls.at(-1).maxOutputLength,raw.length);
    }
    const rgba=adam7(9,11,[255,0,0,255]);
    assert.equal(await getPalette(png(9,11,8,6,1,rgba.subarray(1))),null,'short scanline stream rejected');
    assert.equal(await getPalette(png(9,11,8,6,1,Buffer.concat([rgba,Buffer.from([0])]))),null,'extra scanline bytes rejected');
    const image=new PNG({width:32,height:32});for(let i=0;i<image.data.length;i+=4)image.data.set([255,0,0,255],i);
    assert.equal((await getPalette(PNG.sync.write(image))).Vibrant.hex,'#fc0404');
    assert.equal((await getPalette(fs.readFileSync(path.join(__dirname,'fixtures/executable-icon.png')))).Vibrant.hex,'#639b7f');
    assert.ok(calls.every(call=>Number.isInteger(call.maxOutputLength)&&call.maxOutputLength>0));
    console.log(JSON.stringify({boundedInflate:true,bomb:calls[0],normalAdam7:true,calls}));
  } finally {zlib.inflateSync=original;}
})().catch(error=>{console.error(error);process.exitCode=1;});
