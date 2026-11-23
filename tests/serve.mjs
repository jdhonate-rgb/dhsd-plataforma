// Servidor local sencillo para ver la web: `npm run serve` y abrir http://localhost:8080
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const raiz = new URL('../web/', import.meta.url).pathname;
createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const f = join(raiz, ruta.endsWith('/') ? ruta + 'index.html' : ruta); if (!f.startsWith(raiz)) throw 0; res.writeHead(200, { 'Content-Type': tipos[extname(f)] ?? 'application/octet-stream' }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end('No encontrado'); }
}).listen(8080, () => console.log('http://localhost:8080'));
