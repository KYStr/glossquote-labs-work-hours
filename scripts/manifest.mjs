import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, ASSETS, PRODUCTION_ASSETS, assertSafePath, validatePublic, validateDirectory, validateWorkerConfig } from './validation.mjs';
import { SOURCE_FILES } from './source-files.mjs';

const SOURCE = SOURCE_FILES;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function entries(root, files) {
  const manifest = [];
  for (const file of [...files].sort()) {
    const full = path.join(root, file);
    await assertSafePath(full);
    const bytes = await readFile(full);
    manifest.push({ path: file, bytes: bytes.length, sha256: sha(bytes) });
  }
  return { files: manifest, digest: sha(JSON.stringify(manifest)) };
}
export async function sourceManifest(root = PROJECT_ROOT, { production = false } = {}) {
  await validatePublic(root);
  await validateWorkerConfig(root);
  await validateDirectory(path.join(root, 'dist'), { production });
  const source = await entries(root, SOURCE);
  const runtime = await entries(path.join(root, 'public'), ASSETS);
  const generated = await entries(path.join(root, 'dist'), production ? PRODUCTION_ASSETS : ASSETS);
  if (!production && runtime.digest !== generated.digest) throw new Error('PREVIEW_BYTE_MISMATCH');
  const codeFiles = SOURCE.filter((file) => file.startsWith('public/') || file.startsWith('scripts/') || file.startsWith('test/') || ['package.json', '.gitignore', 'wrangler.jsonc'].includes(file));
  return { schemaVersion: 1, version: '0.1.0', milestone: 'M2-T01', mode: production ? 'production' : 'preview', source, code: await entries(root, codeFiles), runtime, [production ? 'production' : 'preview']: generated };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some((flag) => flag !== '--production')) throw new Error('MANIFEST_ARGUMENT');
    console.log(JSON.stringify(await sourceManifest(PROJECT_ROOT, { production: process.argv.slice(2).includes('--production') }), null, 2));
  }
  catch (error) { console.error(`FAIL manifest: ${error.code ?? 'MANIFEST_FAILED'}`); process.exitCode = 1; }
}
