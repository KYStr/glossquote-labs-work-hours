import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import { mkdir, mkdtemp, writeFile, readFile, lstat, readdir, unlink, rmdir, link, symlink } from 'node:fs/promises';
import { PROJECT_ROOT, ASSETS, assertSafePath, validatePublic, validateHTML, within } from '../scripts/validation.mjs';
import { buildPreview } from '../scripts/build.mjs';
import { startServer } from '../scripts/serve.mjs';

const fixturesRoot = path.join(PROJECT_ROOT, 'test', '.fixtures');
async function ownedFixture(t) {
  await assertSafePath(fixturesRoot, { allowMissing: true });
  await mkdir(fixturesRoot, { recursive: true });
  const base = await mkdtemp(path.join(fixturesRoot, 'm1-'));
  const root = path.join(base, 'project');
  await mkdir(root);
  for (const file of ASSETS) {
    const destination = path.join(root, 'public', file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(path.join(PROJECT_ROOT, 'public', file)), { flag: 'wx' });
  }
  t.after(async () => {
    // Only remove this random, task-owned fixture. Unlink links without walking
    // their targets; external sentinels are never opened for writing or deleting.
    assert.equal(within(fixturesRoot, base), true);
    await assertSafePath(base);
    async function remove(current) {
      assert.equal(within(base, current), true);
      const info = await lstat(current);
      if (info.isSymbolicLink() || info.isFile()) { await unlink(current); return; }
      for (const entry of await readdir(current)) await remove(path.join(current, entry));
      await rmdir(current);
    }
    await remove(base);
  });
  return { base, root };
}
const request = (port, target, method = 'GET') => new Promise((resolve, reject) => {
  const outgoing = http.request({ hostname: '127.0.0.1', port, path: target, method }, (response) => {
    let body = ''; response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
  });
  outgoing.on('error', reject); outgoing.end();
});

test('W31 / W32 actual preview validation and allowlisted build match exact source bytes', async (t) => {
  const { root } = await ownedFixture(t);
  assert.deepEqual(await validatePublic(root), [...ASSETS].sort());
  assert.deepEqual(await buildPreview(root), ASSETS);
  for (const file of ASSETS) assert.deepEqual(await readFile(path.join(root, 'dist', file)), await readFile(path.join(root, 'public', file)));
});
test('W31 dev GET/HEAD/MIME/true 404, traversal and method protections', async (t) => {
  const { root } = await ownedFixture(t);
  const running = await startServer({ root, port: 0 }); t.after(() => running.close());
  for (const [target, type] of [['/', 'text/html'], ['/en/index.html', 'text/html'], ['/js/app.mjs', 'text/javascript'], ['/styles/app.css', 'text/css'], ['/robots.txt', 'text/plain']]) {
    const response = await request(running.port, target); assert.equal(response.status, 200); assert.ok(response.headers['content-type'].startsWith(type));
    assert.equal(response.headers['x-content-type-options'], 'nosniff'); assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow');
    const head = await request(running.port, target, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, ''); assert.ok(Number(head.headers['content-length']) > 0);
  }
  for (const target of ['/missing.html', '/../project.json', '/%2e%2e/project.json', '/%252e%252e/project.json', '/%2e%2e%2fproject.json', '/js/../../project.json', '/.hidden', '/js/%5c..%5cproject.json', '/js/app.mjs?work=private', '/%ZZ', '//index.html']) assert.equal((await request(running.port, target)).status, 404, target);
  const denied = await request(running.port, '/', 'POST'); assert.equal(denied.status, 405); assert.equal(denied.headers.allow, 'GET, HEAD');
  assert.equal(running.server.address().address, '127.0.0.1');
});
test('occupied dev port falls back without stopping its owner', async (t) => {
  const { root } = await ownedFixture(t);
  const first = await startServer({ root, port: 0 }); t.after(() => first.close());
  const second = await startServer({ root, port: first.port }); t.after(() => second.close());
  assert.equal(second.usedFallback, true); assert.notEqual(first.port, second.port);
  assert.equal((await request(first.port, '/')).status, 200); assert.equal((await request(second.port, '/')).status, 200);
});
test('W31 unknown or hidden public files refuse build without leaking source', async (t) => {
  const { root } = await ownedFixture(t);
  await writeFile(path.join(root, 'public', '.private'), 'FAKE_PRIVATE_FIXTURE', { flag: 'wx' });
  await assert.rejects(() => buildPreview(root), { code: 'ASSET_UNKNOWN' });
  await assert.rejects(() => lstat(path.join(root, 'dist')), { code: 'ENOENT' });
});
test('W31 unknown stale dist file refuses whole build and preserves bytes', async (t) => {
  const { root } = await ownedFixture(t);
  await mkdir(path.join(root, 'dist'));
  await writeFile(path.join(root, 'dist', 'stale.txt'), 'STALE_SENTINEL', { flag: 'wx' });
  await assert.rejects(() => buildPreview(root), { code: 'ASSET_UNKNOWN' });
  assert.equal(await readFile(path.join(root, 'dist', 'stale.txt'), 'utf8'), 'STALE_SENTINEL');
});
test('W31 hardlinked dist target refused; sentinel outside build root unchanged', async (t) => {
  const { root, base } = await ownedFixture(t);
  const sentinel = path.join(base, 'outside-sentinel.txt');
  await writeFile(sentinel, 'OUTSIDE_HARDLINK_SENTINEL', { flag: 'wx' });
  await mkdir(path.join(root, 'dist')); await link(sentinel, path.join(root, 'dist', 'index.html'));
  await assert.rejects(() => buildPreview(root), { code: 'PATH_HARDLINK' });
  assert.equal(await readFile(sentinel, 'utf8'), 'OUTSIDE_HARDLINK_SENTINEL');
});
test('W31 ancestor junction/symlink checked even when final root is a plain directory', async (t) => {
  const { root, base } = await ownedFixture(t);
  const linked = path.join(base, 'linked-parent');
  await symlink(root, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => validatePublic(linked), { code: 'PATH_LINK' });
  await assert.rejects(() => assertSafePath(path.join(linked, 'public', 'index.html')), { code: 'PATH_LINK' });
  assert.match(await readFile(path.join(root, 'public', 'index.html'), 'utf8'), /工時加總/);
});
test('W31 dev refuses an asset replaced by a link after startup', async (t) => {
  const { root, base } = await ownedFixture(t);
  const running = await startServer({ root, port: 0 }); t.after(() => running.close());
  const asset = path.join(root, 'public', 'js', 'app.mjs');
  const sentinel = path.join(base, 'outside-sentinel.mjs'); await writeFile(sentinel, 'OUTSIDE_STATIC_SENTINEL', { flag: 'wx' });
  await unlink(asset); await link(sentinel, asset);
  const response = await request(running.port, '/js/app.mjs'); assert.equal(response.status, 404); assert.ok(!response.body.includes('OUTSIDE'));
  assert.equal(await readFile(sentinel, 'utf8'), 'OUTSIDE_STATIC_SENTINEL');
});
test('W31 active HTML references cover case, all quotes and comments; homepage whitelist only applies to navigation', async () => {
  const source = await readFile(path.join(PROJECT_ROOT, 'public', 'index.html'), 'utf8');
  for (const snippet of [
    '<SCRIPT TYPE=module SRC="https://glossquote.com/index.html"></SCRIPT>',
    "<script type='module' src='https://evil.invalid/app.mjs'></script>",
    '<script TYPE=module SRC=https://evil.invalid/app.mjs></script>',
    '<a HREF="javascript:alert(1)">bad</a>', '<a href="&#106;avascript:alert(1)">bad</a>',
    '<img SRC=//evil.invalid/a.png>', '<input OnFocus="alert(1)">'
  ]) assert.throws(() => validateHTML(source.replace('</body>', `${snippet}</body>`), 'index.html'));
  const commented = source.replace('<meta name="robots" content="noindex,nofollow">', '<!-- <meta name="robots" content="noindex,nofollow"> -->');
  assert.throws(() => validateHTML(commented, 'index.html'), { code: 'PREVIEW_ROBOTS' });
  assert.doesNotThrow(() => validateHTML(source.replace('</body>', '<!-- <SCRIPT SRC=https://evil.invalid/no.mjs></SCRIPT> --></body>'), 'index.html'));
  assert.doesNotThrow(() => validateHTML(source.replace('src="js/app.mjs"', "SRC='js/app.mjs'"), 'index.html'));
});
