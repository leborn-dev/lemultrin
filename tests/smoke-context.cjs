const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const evidenceNames = new Set([
  'gui-main.png', 'gui-menu.png', 'gui-smoke.json',
  'packaged-main.png', 'packaged-smoke.json', 'packaged-runtime.log',
]);

// Smoke runs own their directories. No command-line or environment-supplied
// output path can select an existing directory or overwrite another file.
function createSmokeContext() {
  const owned = fs.mkdtempSync(path.join(os.tmpdir(), 'multrin-smoke-'));
  const home = path.join(owned, 'home');
  const output = path.join(owned, 'evidence');
  fs.mkdirSync(home);
  fs.mkdirSync(output);
  return Object.freeze({
    home,
    output,
    writeEvidence(name, content) {
      if (!evidenceNames.has(name)) throw new Error('Unsupported evidence name');
      fs.writeFileSync(path.join(output, name), content, {flag:'wx'});
    },
  });
}

function selectPackagedLayout(platform, arch) {
  if (platform === 'darwin' && arch === 'arm64') return {
    binary:'mac-arm64/Multrin.app/Contents/MacOS/Multrin',
    resources:'mac-arm64/Multrin.app/Contents/Resources/app.asar',
  };
  if (platform === 'darwin' && arch === 'x64') return {
    binary:'mac/Multrin.app/Contents/MacOS/Multrin',
    resources:'mac/Multrin.app/Contents/Resources/app.asar',
  };
  if (platform === 'win32' && arch === 'x64') return {
    binary:'win-unpacked/Multrin.exe', resources:'win-unpacked/resources/app.asar',
  };
  throw new Error('Unsupported packaged smoke platform or architecture');
}

function containedArtifact(directory, relativeName) {
  const root = fs.realpathSync(directory);
  const file = fs.realpathSync(path.resolve(root, relativeName));
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(file).isFile()) {
    throw new Error('Packaged smoke artifact must be a file inside its dist directory');
  }
  return file;
}

function packagedExecutable() {
  const layout = selectPackagedLayout(process.platform, process.arch);
  const repository = fs.realpathSync(path.join(__dirname, '..'));
  const expectedDist = path.join(repository, 'dist');
  const dist = fs.realpathSync(expectedDist);
  if (path.relative(expectedDist, dist) !== '') throw new Error('Repository dist directory must not be redirected');
  const binary = containedArtifact(dist, layout.binary);
  containedArtifact(dist, layout.resources);
  return binary;
}

module.exports = {createSmokeContext, selectPackagedLayout, packagedExecutable, containedArtifact};
