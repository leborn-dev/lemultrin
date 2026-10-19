const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.join(__dirname, '../src/renderer/views/app/utils/colors.ts');
const instance = new Module(file, module);
instance._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText, file);
const {shadeBlendConvert} = instance.exports;
assert.equal(shadeBlendConvert(0.5, '#ff0000', '#0000ff'), '#800080', 'strict unbound tab color blend');
assert.equal(shadeBlendConvert(-0.5, '#abcdef'), '#566778');
assert.equal(shadeBlendConvert(0.5, '#123'), '#889199');
assert.equal(shadeBlendConvert(0.5, 'rgba(255,0,0,0.2)', 'rgba(0,0,255,0.8)'), 'rgba(128,0,128,0.5)');
assert.equal(shadeBlendConvert(2, '#123'), null);
assert.equal(shadeBlendConvert(0.5, 'invalid'), null);
assert.equal(Object.hasOwn(globalThis, 'sbcRip'), false, 'blend parser does not mutate calling context');
console.log('Color blend: unbound strict calls, RGB/hex/alpha, malformed input, no context mutation');
