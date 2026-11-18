// serve.ts — a tiny static file server for playing SOLMARA locally.
// Run `node serve.ts` from the repository root, then open
// http://localhost:8080 in desktop Chrome. Development only: the game
// itself is plain static files under game/ and any static server works.
// Node 22, standard library only, no dependencies.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = join(process.cwd(), 'game');
const PORT = 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '');
    if (path === '') path = 'index.html';
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const bytes = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`SOLMARA at http://localhost:${PORT}`);
});
