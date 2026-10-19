const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const helper = path.join(__dirname, 'smoke-context.cjs');
assert.ok(fs.existsSync(helper), 'smoke helper creates and owns its isolated output/home');
const {createSmokeContext, selectPackagedLayout, containedArtifact} = require(helper);
const context = createSmokeContext();
try {
  assert.notEqual(context.home, require('node:os').homedir());
  for (const name of ['../escaped.json', '/tmp/escaped.json', 'nested/escaped.json', 'unknown.json']) {
    assert.throws(() => context.writeEvidence(name, 'unsafe'), /Unsupported evidence name/);
  }
  context.writeEvidence('gui-smoke.json', '{}');
  assert.equal(fs.readFileSync(path.join(context.output, 'gui-smoke.json'), 'utf8'), '{}');
  assert.throws(() => context.writeEvidence('gui-smoke.json', 'overwrite'), /EEXIST/);
  fs.writeFileSync(path.join(context.home, 'outside.exe'), 'fixture');
  assert.throws(() => containedArtifact(context.output, '../home/outside.exe'), /inside its dist directory/);
  assert.throws(() => containedArtifact(context.output, path.join(context.home, 'outside.exe')), /inside its dist directory/);
  fs.symlinkSync(context.home, path.join(context.output, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => containedArtifact(context.output, 'escape/outside.exe'), /inside its dist directory/);
  assert.throws(() => selectPackagedLayout('darwin', '../../bin/sh'), /Unsupported/);
  assert.throws(() => selectPackagedLayout('linux', 'x64'), /Unsupported/);
  assert.equal(selectPackagedLayout('darwin', 'arm64').binary, 'mac-arm64/Multrin.app/Contents/MacOS/Multrin');
  const child = spawnSync(process.execPath, [path.join(__dirname, 'package-smoke.cjs'), '/tmp/untrusted-command'], {encoding:'utf8'});
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /does not accept executable paths/);
  console.log('Smoke isolation: generated HOME/output, fixed evidence allowlist, exclusive writes, fixed executable selection');
} finally {
  fs.rmSync(path.dirname(context.home), {recursive:true});
}
