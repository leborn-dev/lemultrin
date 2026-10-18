const assert = require('assert');
const http = require('http');
const { createRequire } = require('module');

// Resolve exactly the installer chain; never load the native iohook addon.
const fromIohook = createRequire(require.resolve('iohook/package.json'));
const fromNugget = createRequire(fromIohook.resolve('nugget/package.json'));
const request = fromNugget('request');
const fromRequest = createRequire(fromNugget.resolve('request/package.json'));
const FormData = fromRequest('form-data');

async function test() {
  const originalRandom = Math.random;
  try {
    Math.random = () => { throw new Error('multipart boundary used predictable Math.random'); };
    assert.ok(new FormData().getBoundary().length > 20);
  } finally {
    Math.random = originalRandom;
  }

  const malicious = new FormData();
  malicious.append('field"\r\nX-Injection: yes\r\nfoo="', Buffer.from('safe'), {
    filename: 'file"\r\nX-File-Injection: yes\r\nfoo=".txt'
  });
  const encoded = malicious.getBuffer().toString('latin1');
  assert.ok(!encoded.includes('\r\nX-Injection: yes\r\n'), 'field name cannot inject multipart headers');
  assert.ok(!encoded.includes('\r\nX-File-Injection: yes\r\n'), 'filename cannot inject multipart headers');

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const text = body.toString('latin1');
        const boundary = req.headers['content-type'].split('boundary=')[1];
        assert.ok(boundary, 'multipart boundary is advertised');
        assert.ok(text.includes('name="label"\r\n\r\nlocal-only'), 'field survives request transport');
        assert.ok(text.includes('filename="sample.bin"'), 'filename survives request transport');
        assert.ok(body.includes(Buffer.from([0, 1, 2, 255])), 'binary payload survives request transport');
        assert.ok(text.endsWith('--' + boundary + '--\r\n'), 'multipart closes its advertised boundary');
        assert.equal(Number(req.headers['content-length']), body.length, 'request length is correct');
        res.end('ok');
      } catch (error) { res.statusCode = 500; res.end(error.message); }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await new Promise((resolve, reject) => request.post({
      url: `http://127.0.0.1:${server.address().port}/`, timeout: 5000,
      formData: {label: 'local-only', upload: {value: Buffer.from([0, 1, 2, 255]), options: {filename: 'sample.bin'}}}
    }, (error, response, body) => {
      if (error) return reject(error);
      try { assert.equal(response.statusCode, 200, body); assert.equal(body, 'ok'); resolve(); }
      catch (failure) { reject(failure); }
    }));
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('Installer multipart: secure boundary, header escaping, local request field/file roundtrip passed');
}
test().catch(error => { console.error(error); process.exitCode = 1; });
