const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.map':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.woff2':'font/woff2','.ttf':'font/ttf'};
function createDevServer(root = path.join(__dirname, '../build')) {
  return http.createServer(async (request, response) => {
    const send = (code, text) => { response.writeHead(code, {'Content-Type':'text/plain'}); response.end(text); };
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host || '')) return send(403,'Loopback host required');
    if (!['GET','HEAD'].includes(request.method)) return send(405,'Method not allowed');
    try {
      const base = await fs.realpath(root);
      const relative = decodeURIComponent(new URL(request.url,'http://localhost').pathname).slice(1) || 'app.html';
      const file = await fs.realpath(path.resolve(base,relative));
      const within = path.relative(base,file);
      if (within.startsWith('..') || path.isAbsolute(within) || !mime[path.extname(file)]) return send(403,'Forbidden');
      const content = await fs.readFile(file);
      response.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { send(404,'Not found'); }
  });
}
if (require.main === module) createDevServer().listen(4444,'127.0.0.1',()=>console.log('Multrin dev assets: http://localhost:4444'));
module.exports = {createDevServer};
