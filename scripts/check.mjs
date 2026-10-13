import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PROJECT_ROOT, validatePublic, validateDirectory, validateWorkerConfig, assertSafePath } from './validation.mjs';

try {
  const production = process.argv.slice(2).includes('--production');
  if (process.argv.slice(2).some((flag) => flag !== '--production')) throw new Error('CHECK_ARGUMENT');
  const files = production ? await validateDirectory(path.join(PROJECT_ROOT, 'dist'), { production: true, syntax: true }) : await validatePublic(PROJECT_ROOT, { syntax: true });
  await validateWorkerConfig(PROJECT_ROOT);
  await assertSafePath(path.join(PROJECT_ROOT, 'package.json'));
  const config = JSON.parse(await readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  if (config.type !== 'module' || config.private !== true || config.engines?.node !== '>=24' || Object.keys(config.dependencies ?? {}).length || Object.keys(config.devDependencies ?? {}).length) throw new Error('PACKAGE_CONTRACT');
  let helpers = 0;
  for (const directory of ['scripts', 'test']) {
    for (const item of await readdir(path.join(PROJECT_ROOT, directory), { withFileTypes: true })) {
      if (!item.name.endsWith('.mjs')) continue;
      const full = path.join(PROJECT_ROOT, directory, item.name);
      await assertSafePath(full);
      const checked = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8', windowsHide: true });
      if (checked.status !== 0) throw new Error('HELPER_SYNTAX');
      helpers++;
    }
  }
  console.log(`PASS ${production ? 'production ' : ''}check: ${files.length} allowlisted assets, locale parity, active references, safety/Worker/package contracts, ${helpers} helper/test syntax checks`);
} catch (error) {
  console.error(`FAIL check: ${error.code ?? 'VALIDATION_FAILED'}`);
  process.exitCode = 1;
}
