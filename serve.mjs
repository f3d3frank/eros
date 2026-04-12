import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = 3001;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.mjs':  'text/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.ico':  'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filePath = join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

    // Seguridad: bloquear path traversal
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }

    // Para directorios, servir index.html
    try {
      const s = await stat(filePath);
      if (s.isDirectory()) filePath = join(filePath, 'index.html');
    } catch {}

    const fileStats = await stat(filePath);
    const fileSize = fileStats.size;
    const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    const range = req.headers.range;

    // Range requests para video MP4
    if (range && mime === 'video/mp4') {
      const [startStr, endStr] = range.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : Math.min(start + 1_000_000, fileSize - 1);
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSize,
        'Content-Type':   mime,
      });
      createReadStream(filePath, { start, end }).pipe(res);
    } else {
      const data = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type':   mime,
        'Content-Length': data.length,
        'Cache-Control':  'no-cache',
        'Accept-Ranges':  'bytes',
      });
      res.end(data);
    }

  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      console.error(err);
      res.writeHead(500); res.end('Internal Server Error');
    }
  }
}).listen(PORT, () => {
  console.log(`EROS LIBRE server running → http://localhost:${PORT}`);
});
