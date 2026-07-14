'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3000);
const root = __dirname;
const appVersion = require('./package.json').version;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestHost = url.hostname.toLowerCase();
  if (requestHost === '127.0.0.1' || requestHost === '[::1]') {
    res.writeHead(308, {
      Location: `http://localhost:${port}${url.pathname}${url.search}`,
      'Cache-Control': 'no-store',
    }).end();
    return;
  }

  const duplicatePrefix = ['/clutchzone-app/dist/', '/clutchzone-app/'].find(prefix => url.pathname.startsWith(prefix));
  if (duplicatePrefix) {
    const canonicalPath = `/${url.pathname.slice(duplicatePrefix.length) || 'index.html'}`;
    res.writeHead(308, {
      Location: `${canonicalPath}${url.search}`,
      'Cache-Control': 'no-store',
      'X-ClutchZone-Version': appVersion,
    }).end();
    return;
  }

  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.normalize(path.join(root, requested));
  const relative = path.relative(root, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative) || /^(data|backend|\.git)(\\|\/|$)/.test(relative)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    const isVersionedFrontendAsset = ['.html', '.css', '.js'].includes(extension);
    res.writeHead(200, {
      'Content-Type': mime[extension] || 'application/octet-stream',
      'Cache-Control': isVersionedFrontendAsset ? 'no-store, max-age=0, must-revalidate' : 'public, max-age=300',
      ...(isVersionedFrontendAsset ? { Pragma: 'no-cache', Expires: '0' } : {}),
      'X-ClutchZone-Version': appVersion,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(port, () => console.log(`CLUTCHZONE frontend: http://localhost:${port}`));
