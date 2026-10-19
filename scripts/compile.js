const { spawn } = require('child_process');
const { platform } = require('os');

const os = platform();

let npm = os === 'win32' ? 'npm.cmd' : 'npm';

const runScript = script => {
  const child = spawn(npm, ['run', script], { cwd: require('path').join(__dirname, '..'), stdio: 'inherit' });
  child.on('exit', code => { process.exitCode = code || 0; });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
};

const { TRAVIS_COMMIT_MESSAGE } = process.env;

if (
  (TRAVIS_COMMIT_MESSAGE &&
    TRAVIS_COMMIT_MESSAGE.startsWith('chore: bump version')) ||
  !TRAVIS_COMMIT_MESSAGE
) {
  if (os === 'win32') runScript('compile-win32');
  else if (os === 'darwin') runScript('compile-darwin');
  else if (os === 'linux') runScript('compile-linux');
}