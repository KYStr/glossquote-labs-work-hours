import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, lstat, readdir, unlink, rmdir } from 'node:fs/promises';
import { ASSETS, PRODUCTION_ASSETS, PROJECT_ROOT, assertSafePath, within, validatePublic, validateDirectory, validateWorkerConfig, validateHTML } from '../scripts/validation.mjs';
import { buildPreview, buildProduction } from '../scripts/build.mjs';
import { startServer } from '../scripts/serve.mjs';
import { JSON_LD, PRODUCTION_CSP, LD_HASHES } from '../scripts/release-contract.mjs';
import { isolatedEnvironment } from '../scripts/dry-run.mjs';
import { gitBytes, commitBlobs, archiveAndExtract, zipEntries, crc32 } from '../scripts/source-archive.mjs';

const fixturesRoot = path.join(PROJECT_ROOT, 'test', '.fixtures');
async function fixture(t) {
  await assertSafePath(fixturesRoot, { allowMissing: true }); await mkdir(fixturesRoot, { recursive: true });
  const base = await mkdtemp(path.join(fixturesRoot, 'release-'));
  const root = path.join(base, 'project'); await mkdir(root);
  for (const file of ASSETS) {
    const target = path.join(root, 'public', file); await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(path.join(PROJECT_ROOT, 'public', file)), { flag: 'wx' });
  }
  await writeFile(path.join(root, 'wrangler.jsonc'), await readFile(path.join(PROJECT_ROOT, 'wrangler.jsonc')), { flag: 'wx' });
  t.after(async () => {
    assert.equal(within(fixturesRoot, base), true); await assertSafePath(base);
    async function remove(current) {
      assert.equal(within(base, current), true);
      const info = await lstat(current);
      if (info.isSymbolicLink() || info.isFile()) { await unlink(current); return; }
      for (const item of await readdir(current)) await remove(path.join(current, item));
      await rmdir(current);
    }
    await remove(base);
  });
  return { base, root };
}
const request = (port, target, method = 'GET') => new Promise((resolve, reject) => {
  const outgoing = http.request({ hostname: '127.0.0.1', port, path: target, method, headers: { Host: 'untrusted.invalid' } }, (response) => {
    let body = ''; response.setEncoding('utf8'); response.on('data', (value) => { body += value; });
    response.on('end', () => resolve({ status: response.statusCode, body, headers: response.headers }));
  });
  outgoing.on('error', reject); outgoing.end();
});

test('W32 production has exact bilingual canonical/alternates/OG/JSON-LD and both CSP hashes', async (t) => {
  const { root } = await fixture(t);
  await buildProduction(root);
  assert.deepEqual(await validateDirectory(path.join(root, 'dist'), { production: true }), [...PRODUCTION_ASSETS].sort());
  for (const [file, locale, canonical] of [['index.html', 'zh-Hant', 'https://hours.glossquote.com/index.html'], ['en/index.html', 'en', 'https://hours.glossquote.com/en/index.html']]) {
    const source = await readFile(path.join(root, 'dist', file), 'utf8');
    assert.match(source, new RegExp(`<link rel="canonical" href="${canonical.replaceAll('.', '\\.')}">`));
    assert.equal((source.match(/rel="alternate"/g) ?? []).length, 3);
    assert.ok(source.includes('hreflang="zh-Hant" href="https://hours.glossquote.com/index.html"'));
    assert.ok(source.includes('hreflang="en" href="https://hours.glossquote.com/en/index.html"'));
    assert.ok(source.includes('hreflang="x-default" href="https://hours.glossquote.com/index.html"'));
    assert.ok(source.includes(`<meta property="og:url" content="${canonical}">`));
    assert.ok(source.includes('content="index,follow"')); assert.ok(!source.includes('content="noindex,nofollow"'));
    const json = /<script type="application\/ld\+json">([^<]+)<\/script>/.exec(source)[1];
    assert.deepEqual(JSON.parse(json), { '@context': 'https://schema.org', '@type': 'WebApplication', name: locale === 'en' ? 'Work Hours Calculator' : '工時加總', url: canonical, inLanguage: locale, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web', description: JSON.parse(JSON_LD[locale]).description });
    const hash = `'sha256-${createHash('sha256').update(json).digest('base64')}'`;
    assert.ok(PRODUCTION_CSP.includes(hash)); assert.ok(LD_HASHES.includes(hash));
    assert.ok(!/unsafe-inline|unsafe-eval|aggregateRating|reviewCount/.test(source));
    assert.throws(() => validateHTML(source.replace(canonical, 'https://untrusted.invalid/index.html'), file, { production: true }));
  }
  const sitemap = await readFile(path.join(root, 'dist', 'sitemap.xml'), 'utf8');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((item) => item[1]), ['https://hours.glossquote.com/index.html', 'https://hours.glossquote.com/en/index.html']);
  assert.equal(await readFile(path.join(root, 'dist', 'robots.txt'), 'utf8'), 'User-agent: *\nAllow: /\nSitemap: https://hours.glossquote.com/sitemap.xml\n');
});
test('preview/production switching is deterministic and removes only the known generated sitemap', async (t) => {
  const { root } = await fixture(t);
  await buildProduction(root); const first = await readFile(path.join(root, 'dist', 'index.html'));
  await buildProduction(root); assert.deepEqual(await readFile(path.join(root, 'dist', 'index.html')), first);
  await buildPreview(root); await validateDirectory(path.join(root, 'dist'));
  await assert.rejects(() => lstat(path.join(root, 'dist', 'sitemap.xml')), { code: 'ENOENT' });
  for (const file of ASSETS) assert.deepEqual(await readFile(path.join(root, 'dist', file)), await readFile(path.join(root, 'public', file)));
  await assert.rejects(() => validateDirectory(path.join(root, 'dist'), { production: true }));
});
test('M2 actual loopback production HTTP: HTML/CSS/JS/XML/TXT, HEAD, headers and real 404 without SPA fallback', async (t) => {
  const { root } = await fixture(t); await buildProduction(root);
  const running = await startServer({ root, production: true, port: 0 }); t.after(() => running.close());
  for (const [target, type] of [['/index.html', 'text/html'], ['/en/index.html', 'text/html'], ['/styles/app.css', 'text/css'], ['/js/app.mjs', 'text/javascript'], ['/sitemap.xml', 'application/xml'], ['/robots.txt', 'text/plain']]) {
    const result = await request(running.port, target);
    assert.equal(result.status, 200); assert.ok(result.headers['content-type'].startsWith(type));
    assert.equal(result.headers['x-content-type-options'], 'nosniff'); assert.equal(result.headers['referrer-policy'], 'no-referrer');
    assert.equal(result.headers['content-security-policy'], PRODUCTION_CSP); assert.equal(result.headers['x-frame-options'], 'DENY');
    assert.equal(result.headers['x-robots-tag'], undefined);
    if (type === 'text/html') assert.ok(result.body.includes('https://hours.glossquote.com/') && !result.body.includes('untrusted.invalid'));
    const head = await request(running.port, target, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, '');
  }
  for (const target of ['/missing', '/deep/missing.html', '/_headers', '/../project.json', '/%2e%2e/project.json']) {
    const result = await request(running.port, target); assert.equal(result.status, 404); assert.match(result.body, /Page not found/); assert.match(result.body, /找不到頁面/);
    assert.ok(!result.body.includes('id="worksheet"')); assert.ok(!result.body.includes('untrusted.invalid'));
    assert.match(result.body, /content="noindex,nofollow"/); assert.equal(result.headers['content-security-policy'], PRODUCTION_CSP);
  }
});
test('active meta refresh is rejected for every quote/case form before check/build alter existing output', async (t) => {
  const { root } = await fixture(t); await buildPreview(root);
  const htmlFile = path.join(root, 'public', 'index.html'), source = await readFile(htmlFile, 'utf8');
  const original = await readFile(path.join(root, 'dist', 'index.html'));
  for (const tag of ['<meta http-equiv="refresh" content="0; url=https://untrusted.invalid/">', "<META HTTP-EQUIV='Refresh' CONTENT='0;URL=//untrusted.invalid/'>", '<meta HTTP-EQUIV=refresh content="0;url=https://untrusted.invalid/">']) {
    await writeFile(htmlFile, source.replace('</head>', `${tag}</head>`));
    await assert.rejects(() => validatePublic(root), { code: 'HTML_REFRESH' });
    await assert.rejects(() => buildPreview(root), { code: 'HTML_REFRESH' });
    await assert.rejects(() => buildProduction(root), { code: 'HTML_REFRESH' });
    assert.deepEqual(await readFile(path.join(root, 'dist', 'index.html')), original);
  }
});
test('production refuses modified sitemap, unsafe headers, JSON-LD and surprise config capabilities', async (t) => {
  const { root } = await fixture(t); await buildProduction(root);
  const sitemap = path.join(root, 'dist', 'sitemap.xml'), originalSitemap = await readFile(sitemap, 'utf8');
  await writeFile(sitemap, originalSitemap.replace('hours.glossquote.com', 'untrusted.invalid'));
  await assert.rejects(() => validateDirectory(path.join(root, 'dist'), { production: true }), { code: 'PRODUCTION_SITEMAP' });
  await writeFile(sitemap, originalSitemap);
  const headerFile = path.join(root, 'dist', '_headers'), originalHeaders = await readFile(headerFile, 'utf8');
  await writeFile(headerFile, originalHeaders.replace("connect-src 'none'", 'connect-src *'));
  await assert.rejects(() => validateDirectory(path.join(root, 'dist'), { production: true }), { code: 'HEADERS_CONTRACT' });
  await writeFile(headerFile, originalHeaders);
  const html = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
  assert.throws(() => validateHTML(html.replace('"UtilitiesApplication"', '"OtherApplication"'), 'index.html', { production: true }), { code: 'PRODUCTION_JSON_LD' });
  const configFile = path.join(root, 'wrangler.jsonc'), config = JSON.parse(await readFile(configFile, 'utf8'));
  await writeFile(configFile, JSON.stringify({ ...config, vars: { FAKE_REMOTE_FEATURE: 'not-allowed' } }));
  await assert.rejects(() => validateWorkerConfig(root), { code: 'WORKER_CONFIG' });
});
test('dry-run child environment has isolated homes/cache/temp and no inherited credential variables', () => {
  const environment = isolatedEnvironment(path.join(fixturesRoot, 'fake-cli-state'));
  assert.equal(environment.WRANGLER_SEND_METRICS, 'false'); assert.equal(environment.CI, 'true');
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_EMAIL', 'GH_TOKEN', 'GITHUB_TOKEN', 'NODE_OPTIONS']) assert.equal(Object.hasOwn(environment, key), false);
  assert.equal(within(fixturesRoot, environment.USERPROFILE), true); assert.equal(within(fixturesRoot, environment.TEMP), true);
});
test('fixed Git archive extracts every file byte-for-byte against actual Git blobs; CRC/traversal negatives', async (t) => {
  const { base } = await fixture(t);
  const repository = path.join(base, 'repository'); await mkdir(repository);
  const allowed = ['nested/script.mjs', 'plain.txt'];
  await mkdir(path.join(repository, 'nested'));
  await writeFile(path.join(repository, 'plain.txt'), 'FAKE CRLF\r\n測試\n', { flag: 'wx' });
  await writeFile(path.join(repository, 'nested', 'script.mjs'), 'export const answer = 42;\n', { flag: 'wx' });
  gitBytes(repository, ['-c', 'init.templateDir=', 'init', '-b', 'main']);
  gitBytes(repository, ['add', '--all']);
  gitBytes(repository, ['-c', 'user.name=Archive Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic archive fixture']);
  const commit = gitBytes(repository, ['rev-parse', 'HEAD']).toString().trim();
  const result = await archiveAndExtract({ repository, commit, archivePath: path.join(base, 'fixed.zip'), extractDirectory: path.join(base, 'extracted'), allowed });
  assert.equal(result.files.length, 2); assert.equal(result.commit, commit);
  const blobs = await commitBlobs(repository, commit, allowed);
  for (const file of result.files) assert.deepEqual(await readFile(path.join(result.extractDirectory, file.path)), blobs.get(file.path).bytes);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const archive = await readFile(result.archivePath); assert.equal(createHash('sha256').update(archive).digest('hex'), result.archiveSha256);
  assert.equal(zipEntries(archive, allowed, commit).size, 2);
  assert.throws(() => zipEntries(archive, allowed, '0'.repeat(40)), { code: 'ZIP_COMMIT' });
  const malicious = Buffer.from(archive); let position = 0;
  while ((position = malicious.indexOf(Buffer.from('plain.txt'), position)) !== -1) { malicious.write('../aa.txt', position, 'utf8'); position += 9; }
  assert.throws(() => zipEntries(malicious, allowed, commit), { code: 'ZIP_ENTRY' });
  await assert.rejects(() => archiveAndExtract({ repository, commit, archivePath: result.archivePath, extractDirectory: path.join(base, 'second'), allowed }), { code: 'ARCHIVE_EXISTS' });
});
