import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, PRODUCTION_ASSETS, assertSafePath, validateWorkerConfig, validateDirectory } from './validation.mjs';

export function isolatedEnvironment(stateRoot) {
  const environment = {};
  // These are OS/tool-discovery settings, never credential variables.
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'Path', 'PATHEXT', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE']) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  Object.assign(environment, {
    USERPROFILE: path.join(stateRoot, 'home'), APPDATA: path.join(stateRoot, 'home', 'roaming'),
    LOCALAPPDATA: path.join(stateRoot, 'home', 'local'),
    XDG_CONFIG_HOME: path.join(stateRoot, 'config'), XDG_CACHE_HOME: path.join(stateRoot, 'cache'),
    TEMP: path.join(stateRoot, 'temp'), TMP: path.join(stateRoot, 'temp'),
    CI: 'true', WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: path.join(stateRoot, 'wrangler.log'),
    BROWSER: 'none', NO_COLOR: '1'
  });
  return environment;
}
export async function runDryRun({ root = PROJECT_ROOT, wrangler, stateDirectory, info = false }) {
  if (!wrangler || !stateDirectory || !path.isAbsolute(wrangler) || !path.isAbsolute(stateDirectory)) throw new Error('DRY_RUN_ARGUMENT');
  await assertSafePath(root);
  await assertSafePath(wrangler);
  const stateRoot = path.resolve(stateDirectory);
  if (stateRoot === path.parse(stateRoot).root || stateRoot === path.resolve(root)) throw new Error('DRY_RUN_STATE_SCOPE');
  await assertSafePath(path.dirname(stateRoot));
  // Refuse reuse: this also prevents reading existing login/config/cache state.
  await mkdir(stateRoot);
  for (const directory of ['home', 'home/roaming', 'home/local', 'config', 'cache', 'temp', 'bundle', 'project']) await mkdir(path.join(stateRoot, directory), { recursive: true });
  const environment = isolatedEnvironment(stateRoot);
  const wranglerPackage = path.join(path.dirname(wrangler), '..', 'package.json');
  await assertSafePath(wranglerPackage);
  const packageJSON = JSON.parse(await readFile(wranglerPackage, 'utf8'));
  if (packageJSON.name !== 'wrangler' || !/^4\.[0-9]+\.[0-9]+$/.test(packageJSON.version)) throw new Error('WRANGLER_VERSION');
  if (!info) {
    if ((await readdir(root)).some((name) => /^\.env(?:\.|$)|^\.dev\.vars(?:\.|$)/.test(name))) throw new Error('LOCAL_SECRET_FILE_PRESENT');
    await validateWorkerConfig(root);
    await validateDirectory(path.join(root, 'dist'), { production: true });
    await writeFile(path.join(stateRoot, 'project', 'wrangler.jsonc'), await readFile(path.join(root, 'wrangler.jsonc')), { flag: 'wx' });
    for (const file of PRODUCTION_ASSETS) {
      const target = path.join(stateRoot, 'project', 'dist', file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, await readFile(path.join(root, 'dist', file)), { flag: 'wx' });
    }
  }
  const argumentsList = info ? [wrangler, 'deploy', '--help'] : [wrangler, 'deploy', '--dry-run', '--autoconfig=false', '--config', path.join(stateRoot, 'project', 'wrangler.jsonc'), '--outdir', path.join(stateRoot, 'bundle')];
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argumentsList, { cwd: path.join(stateRoot, 'project'), env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const append = (stream, chunk) => {
      if (stdout.length + stderr.length + chunk.length > 2 * 1024 * 1024) { child.kill(); reject(new Error('DRY_RUN_OUTPUT_LIMIT')); return; }
      if (stream === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
    };
    child.stdout.on('data', (chunk) => append('stdout', chunk)); child.stderr.on('data', (chunk) => append('stderr', chunk));
    child.on('error', () => reject(new Error('DRY_RUN_PROCESS')));
    child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
  return { wranglerVersion: packageJSON.version, nodeVersion: process.version, stateRoot, ...output };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argumentsList = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < argumentsList.length; i++) {
      const argument = argumentsList[i];
      if (argument === '--info') { options.info = true; continue; }
      if (argument !== '--wrangler' && argument !== '--state-dir') throw new Error('DRY_RUN_ARGUMENT');
      const value = argumentsList[++i];
      if (!value) throw new Error('DRY_RUN_ARGUMENT');
      options[argument === '--wrangler' ? 'wrangler' : 'stateDirectory'] = value;
    }
    const result = await runDryRun(options);
    process.stdout.write(result.stdout); process.stderr.write(result.stderr);
    console.log(`${result.exitCode === 0 ? 'PASS' : 'FAIL'} ${options.info ? 'Wrangler help' : 'offline dry-run'}: Wrangler ${result.wranglerVersion}; Node ${result.nodeVersion}; exit ${result.exitCode}`);
    process.exitCode = result.exitCode === 0 ? 0 : 1;
  } catch { console.error('FAIL dry-run: argument, source, state or tool validation'); process.exitCode = 1; }
}
