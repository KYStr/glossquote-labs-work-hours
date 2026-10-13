import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, ASSETS, PRODUCTION_ASSETS, validatePublic, validateTree, validateDirectory, validateWorkerConfig, htmlElements, assertSafePath, within } from './validation.mjs';
import { productionHead, headersText, PRODUCTION_ROBOTS, SITEMAP } from './release-contract.mjs';

export async function buildPreview(root = PROJECT_ROOT) {
  return build(root, false);
}
export async function buildProduction(root = PROJECT_ROOT) {
  return build(root, true);
}
export function productionHTML(source, file) {
  const robots = htmlElements(source).filter(({ tag, attributes }) => tag === 'meta' && attributes.name?.toLowerCase() === 'robots');
  if (robots.length !== 1) throw new Error('PREVIEW_ROBOTS');
  const target = robots[0];
  return source.slice(0, target.start) + productionHead(file === 'index.html' ? 'zh-Hant' : 'en') + source.slice(target.end);
}
async function build(root, production) {
  await validatePublic(root, { syntax: true });
  if (production) await validateWorkerConfig(root);
  const destination = path.join(root, 'dist');
  if (!within(root, destination)) throw new Error('BUILD_SCOPE');
  const previous = await validateTree(destination, { complete: false, optional: true, allowed: PRODUCTION_ASSETS });
  const files = production ? PRODUCTION_ASSETS : ASSETS;
  const output = new Map();
  for (const file of files) {
    let bytes = file === 'sitemap.xml' ? Buffer.from(SITEMAP) : await readFile(path.join(root, 'public', file));
    if (production && ['index.html', 'en/index.html'].includes(file)) bytes = Buffer.from(productionHTML(bytes.toString('utf8'), file));
    if (production && file === 'robots.txt') bytes = Buffer.from(PRODUCTION_ROBOTS);
    if (production && file === '_headers') bytes = Buffer.from(headersText(true));
    output.set(file, bytes);
  }
  await mkdir(destination, { recursive: true });
  for (const file of files) {
    const target = path.join(destination, file);
    await assertSafePath(target, { allowMissing: true });
    await mkdir(path.dirname(target), { recursive: true });
    await assertSafePath(path.dirname(target));
    const bytes = output.get(file);
    const temporary = path.join(destination, `.copy-${randomUUID()}`);
    let created = false;
    try {
      await assertSafePath(destination);
      await writeFile(temporary, bytes, { flag: 'wx' });
      created = true;
      await assertSafePath(target, { allowMissing: true });
      // Atomic replacement changes the directory entry, never a linked target's bytes.
      await rename(temporary, target);
      created = false;
    } catch (error) {
      if (created && within(destination, path.resolve(temporary))) await unlink(temporary).catch(() => {});
      throw error;
    }
  }
  for (const file of previous.filter((name) => !files.includes(name))) {
    const obsolete = path.resolve(destination, file);
    if (!within(destination, obsolete)) throw new Error('BUILD_SCOPE');
    await assertSafePath(obsolete);
    await unlink(obsolete);
  }
  await validateDirectory(destination, { production });
  return [...files];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const production = process.argv.slice(2).includes('--production');
  try {
    if (process.argv.slice(2).some((flag) => flag !== '--production')) throw new Error('BUILD_ARGUMENT');
    console.log(production ? `PASS production build: ${(await buildProduction()).length} static assets; fixed hours.glossquote.com SEO` : `PASS preview build: ${(await buildPreview()).length} static assets; noindex,nofollow`);
  }
  catch (error) { console.error(`FAIL build: ${error.code ?? 'BUILD_FAILED'}`); process.exitCode = 1; }
}
