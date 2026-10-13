import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_FILES } from './source-files.mjs';
import { assertSafePath, within } from './validation.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export class ArchiveError extends Error {
  constructor(code) { super(code); this.name = 'ArchiveError'; this.code = code; }
}
const reject = (code) => { throw new ArchiveError(code); };
const MAX_ARCHIVE = 5 * 1024 * 1024;
const MAX_FILE = 1024 * 1024;

export function gitBytes(repository, args, input) {
  const environment = {};
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'Path', 'PATHEXT', 'TEMP', 'TMP']) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  environment.GIT_CONFIG_NOSYSTEM = '1';
  environment.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  const result = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.hooksPath=.git/no-hooks', '-c', 'core.fsmonitor=false', ...args], {
    cwd: repository, env: environment, input, windowsHide: true, maxBuffer: MAX_ARCHIVE
  });
  if (result.status !== 0) reject('GIT_COMMAND');
  return result.stdout;
}

export async function commitBlobs(repository, commit, allowed = SOURCE_FILES) {
  await assertSafePath(repository);
  if (!/^[a-f0-9]{40}$/.test(commit)) reject('COMMIT_FORMAT');
  const resolved = gitBytes(repository, ['rev-parse', '--verify', `${commit}^{commit}`]).toString().trim();
  if (resolved !== commit) reject('COMMIT_FORMAT');
  const records = gitBytes(repository, ['ls-tree', '-rz', '--full-tree', commit]).toString('utf8').split('\0').filter(Boolean);
  const blobs = new Map();
  let total = 0;
  for (const record of records) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([A-Za-z0-9._/-]+)$/.exec(record);
    if (!match || !allowed.includes(match[3]) || blobs.has(match[3])) reject('GIT_TREE_SCOPE');
    const bytes = gitBytes(repository, ['cat-file', 'blob', match[2]]);
    if (bytes.length > MAX_FILE || (total += bytes.length) > MAX_ARCHIVE) reject('ARCHIVE_SIZE');
    blobs.set(match[3], { bytes, gitBlob: match[2], sha256: sha256(bytes) });
  }
  if (blobs.size !== allowed.length || allowed.some((name) => !blobs.has(name))) reject('GIT_TREE_SCOPE');
  return blobs;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipEntries(archive, allowed = SOURCE_FILES, commit) {
  if (!Buffer.isBuffer(archive) || archive.length > MAX_ARCHIVE || archive.length < 22) reject('ZIP_SIZE');
  const bounds = (offset, length) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > archive.length) reject('ZIP_BOUNDS');
  };
  let end = -1;
  for (let position = archive.length - 22; position >= Math.max(0, archive.length - 65557); position--) {
    if (archive.readUInt32LE(position) === 0x06054b50 && position + 22 + archive.readUInt16LE(position + 20) === archive.length) { end = position; break; }
  }
  if (end < 0 || archive.readUInt16LE(end + 4) !== 0 || archive.readUInt16LE(end + 6) !== 0) reject('ZIP_DIRECTORY');
  const count = archive.readUInt16LE(end + 10);
  if (archive.readUInt16LE(end + 8) !== count || count === 65535 || count > allowed.length * 2 + 10) reject('ZIP_DIRECTORY');
  const size = archive.readUInt32LE(end + 12), offset = archive.readUInt32LE(end + 16);
  if (offset + size !== end) reject('ZIP_DIRECTORY');
  if (commit && archive.subarray(end + 22).toString('utf8') !== commit) reject('ZIP_COMMIT');
  const directories = new Set(allowed.flatMap((file) => file.split('/').slice(0, -1).map((_, i) => file.split('/').slice(0, i + 1).join('/') + '/')));
  const seen = new Set(), entries = new Map();
  let cursor = offset, total = 0;
  for (let index = 0; index < count; index++) {
    bounds(cursor, 46);
    if (archive.readUInt32LE(cursor) !== 0x02014b50) reject('ZIP_DIRECTORY');
    const flags = archive.readUInt16LE(cursor + 8), method = archive.readUInt16LE(cursor + 10);
    const crc = archive.readUInt32LE(cursor + 16), compressed = archive.readUInt32LE(cursor + 20), uncompressed = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28), extraLength = archive.readUInt16LE(cursor + 30), commentLength = archive.readUInt16LE(cursor + 32);
    const attributes = archive.readUInt32LE(cursor + 38), local = archive.readUInt32LE(cursor + 42);
    bounds(cursor + 46, nameLength + extraLength + commentLength);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (seen.has(name) || (flags & 1) || ![0, 8].includes(method) || (attributes >>> 16 & 0xf000) === 0xa000 ||
        !/^[A-Za-z0-9._/-]+$/.test(name) || name.startsWith('/') || name.split('/').some((part) => part === '..' || part === '.')) reject('ZIP_ENTRY');
    seen.add(name);
    if (name.endsWith('/')) {
      if (!directories.has(name) || uncompressed !== 0 || compressed !== 0) reject('ZIP_ENTRY');
    } else {
      if (!allowed.includes(name)) reject('ZIP_SCOPE');
      if (uncompressed > MAX_FILE || (total += uncompressed) > MAX_ARCHIVE) reject('ZIP_SIZE');
      bounds(local, 30);
      if (archive.readUInt32LE(local) !== 0x04034b50 || archive.readUInt16LE(local + 8) !== method || archive.readUInt16LE(local + 6) !== flags) reject('ZIP_LOCAL');
      const localName = archive.readUInt16LE(local + 26), localExtra = archive.readUInt16LE(local + 28);
      bounds(local + 30, localName + localExtra + compressed);
      if (archive.subarray(local + 30, local + 30 + localName).toString('utf8') !== name) reject('ZIP_LOCAL');
      const compressedBytes = archive.subarray(local + 30 + localName + localExtra, local + 30 + localName + localExtra + compressed);
      let bytes;
      try { bytes = method === 0 ? Buffer.from(compressedBytes) : inflateRawSync(compressedBytes, { maxOutputLength: Math.max(1, uncompressed) }); }
      catch { reject('ZIP_INFLATE'); }
      if (bytes.length !== uncompressed || crc32(bytes) !== crc) reject('ZIP_CRC');
      entries.set(name, bytes);
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== end || entries.size !== allowed.length || allowed.some((name) => !entries.has(name))) reject('ZIP_SCOPE');
  return entries;
}

export async function archiveAndExtract({ repository, commit, archivePath, extractDirectory, allowed = SOURCE_FILES }) {
  if (![repository, archivePath, extractDirectory].every((value) => typeof value === 'string' && path.isAbsolute(value))) reject('ARCHIVE_ARGUMENT');
  const archiveFile = path.resolve(archivePath), extractRoot = path.resolve(extractDirectory);
  if (extractRoot === path.parse(extractRoot).root || within(repository, extractRoot) || within(extractRoot, repository) || within(repository, archiveFile) || within(extractRoot, archiveFile)) reject('ARCHIVE_SCOPE');
  await assertSafePath(path.dirname(archiveFile)); await assertSafePath(path.dirname(extractRoot));
  for (const target of [archiveFile, extractRoot]) {
    try { await lstat(target); reject('ARCHIVE_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const blobs = await commitBlobs(repository, commit, allowed);
  const archive = gitBytes(repository, ['archive', '--format=zip', commit]);
  const entries = zipEntries(archive, allowed, commit);
  for (const [name, bytes] of entries) if (!bytes.equals(blobs.get(name).bytes)) reject('ZIP_BLOB_MISMATCH');
  await writeFile(archiveFile, archive, { flag: 'wx' });
  await mkdir(extractRoot);
  const files = [];
  for (const name of [...entries.keys()].sort()) {
    const target = path.resolve(extractRoot, name);
    if (!within(extractRoot, target)) reject('ARCHIVE_SCOPE');
    await mkdir(path.dirname(target), { recursive: true });
    await assertSafePath(target, { allowMissing: true });
    await writeFile(target, entries.get(name), { flag: 'wx' });
    const extracted = await readFile(target);
    if (!extracted.equals(blobs.get(name).bytes)) reject('EXTRACT_BLOB_MISMATCH');
    files.push({ path: name, bytes: extracted.length, gitBlob: blobs.get(name).gitBlob, sha256: sha256(extracted) });
  }
  return { commit, archivePath: archiveFile, archiveBytes: archive.length, archiveSha256: sha256(archive), extractDirectory: extractRoot, files, filesDigest: sha256(Buffer.from(JSON.stringify(files))) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    const names = { '--repository': 'repository', '--commit': 'commit', '--archive': 'archivePath', '--extract': 'extractDirectory' };
    for (let i = 0; i < args.length; i += 2) {
      if (!names[args[i]] || !args[i + 1]) reject('ARCHIVE_ARGUMENT');
      options[names[args[i]]] = args[i + 1];
    }
    console.log(JSON.stringify(await archiveAndExtract(options), null, 2));
  } catch (error) { console.error(`FAIL source archive: ${error.code ?? 'ARCHIVE_FAILED'}`); process.exitCode = 1; }
}
