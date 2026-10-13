import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, ASSETS, PRODUCTION_ASSETS, assertSafePath, validatePublic, validateDirectory, validateWorkerConfig, within } from './validation.mjs';
import { SECURITY_HEADERS, PRODUCTION_CSP } from './release-contract.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };

function assetFor(raw, files) {
  if (typeof raw !== 'string' || raw.length > 2048 || !raw.startsWith('/') || raw.includes('?') || raw.includes('#')) return null;
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { return null; }
  if (/[\\\x00-\x20%]/.test(decoded) || decoded.startsWith('//')) return null;
  const segments = decoded.slice(1).split('/');
  if (segments.some((segment) => segment.startsWith('.'))) return null;
  const asset = decoded === '/' ? 'index.html' : decoded === '/en/' ? 'en/index.html' : decoded.slice(1);
  return asset !== '_headers' && files.includes(asset) ? asset : null;
}

export async function startServer({ root = PROJECT_ROOT, port = 4198, production = false } = {}) {
  const publicRoot = path.join(root, production ? 'dist' : 'public');
  const files = production ? PRODUCTION_ASSETS : ASSETS;
  if (production) { await validateWorkerConfig(root); await validateDirectory(publicRoot, { production: true }); }
  else await validatePublic(root);
  const headers = { ...SECURITY_HEADERS };
  if (production) headers['Content-Security-Policy'] = PRODUCTION_CSP;
  else headers['X-Robots-Tag'] = 'noindex, nofollow';
  const server = http.createServer(async (request, response) => {
    const reply = (status, body, extra = {}) => {
      response.writeHead(status, { ...headers, 'Content-Type': 'text/plain; charset=utf-8', ...extra });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') { reply(405, 'Method not allowed\n', { Allow: 'GET, HEAD' }); return; }
    const asset = assetFor(request.url, files);
    if (!asset) {
      try {
        const fallback = path.join(publicRoot, '404.html');
        await assertSafePath(fallback);
        reply(404, await readFile(fallback), { 'Content-Type': types['.html'] });
      } catch { reply(404, 'Not found\n'); }
      return;
    }
    const full = path.join(publicRoot, asset);
    try {
      if (!within(publicRoot, full)) throw new Error('PATH_ESCAPE');
      await assertSafePath(full);
      const bytes = await readFile(full);
      reply(200, bytes, { 'Content-Type': types[path.extname(asset)], 'Content-Length': String(bytes.length), ...(production && asset === '404.html' ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}) });
    } catch { reply(404, 'Not found\n'); }
  });
  const listen = (listenPort) => new Promise((resolve, reject) => {
    const onError = (error) => { server.removeListener('listening', onListening); reject(error); };
    const onListening = () => { server.removeListener('error', onError); resolve(); };
    server.once('error', onError); server.once('listening', onListening);
    server.listen(listenPort, '127.0.0.1');
  });
  let usedFallback = false;
  try { await listen(port); }
  catch (error) {
    if (error.code !== 'EADDRINUSE' || port === 0) throw error;
    usedFallback = true; await listen(0);
  }
  const actualPort = server.address().port;
  return { server, port: actualPort, url: `http://127.0.0.1:${actualPort}/`, usedFallback,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const production = process.argv.slice(2).includes('--production');
    if (process.argv.slice(2).some((flag) => flag !== '--production')) throw new Error('SERVER_ARGUMENT');
    const running = await startServer({ production });
    console.log(`Work Hours ${production ? 'production candidate' : 'preview'} ${running.url} | PID ${process.pid} | Node ${process.version}${running.usedFallback ? ' | default port occupied; OS-assigned fallback' : ''}`);
  } catch (error) { console.error(`FAIL dev: ${error.code ?? 'SERVER_FAILED'}`); process.exitCode = 1; }
}
