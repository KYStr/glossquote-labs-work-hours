import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { copy } from '../public/js/i18n.mjs';
import { CANONICAL, PAGE, JSON_LD, escapeHTML, headersText, PREVIEW_ROBOTS, PRODUCTION_ROBOTS, SITEMAP, WORKER_CONFIG } from './release-contract.mjs';

export const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const ASSETS = Object.freeze([
  'index.html', 'en/index.html', 'robots.txt', 'styles/app.css',
  'js/app.mjs', 'js/i18n.mjs', 'js/state.mjs', 'js/core/work-hours.mjs', '404.html', '_headers'
]);
export const PRODUCTION_ASSETS = Object.freeze([...ASSETS, 'sitemap.xml']);
export class ValidationError extends Error {
  constructor(code) { super(code); this.name = 'ValidationError'; this.code = code; }
}
const reject = (code) => { throw new ValidationError(code); };

export function within(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

export async function assertSafePath(target, { allowMissing = false } = {}) {
  const full = path.resolve(target);
  const root = path.parse(full).root;
  let current = root;
  const parts = full.slice(root.length).split(path.sep).filter(Boolean);
  for (let i = -1; i < parts.length; i++) {
    if (i >= 0) current = path.join(current, parts[i]);
    let info;
    try { info = await lstat(current); }
    catch (error) {
      if (allowMissing && error.code === 'ENOENT') return;
      reject('PATH_MISSING');
    }
    if (info.isSymbolicLink()) reject('PATH_LINK');
    if (i < parts.length - 1 && !info.isDirectory()) reject('PATH_TYPE');
    if (info.isFile() && info.nlink !== 1) reject('PATH_HARDLINK');
    if (!info.isFile() && !info.isDirectory()) reject('PATH_TYPE');
  }
}

export async function validateTree(directory, { complete = true, optional = false, allowed = ASSETS } = {}) {
  await assertSafePath(directory, { allowMissing: optional });
  try { await lstat(directory); }
  catch (error) { if (optional && error.code === 'ENOENT') return []; throw error; }
  const found = [];
  const directories = new Set(allowed.flatMap((file) => {
    const parts = file.split('/');
    return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
  }));
  async function visit(parent, prefix = '') {
    for (const item of await readdir(parent, { withFileTypes: true })) {
      const relative = `${prefix}${item.name}`;
      const full = path.join(parent, item.name);
      if (!within(directory, full)) reject('PATH_ESCAPE');
      await assertSafePath(full);
      if (item.isDirectory()) {
        if (!directories.has(relative)) reject('ASSET_UNKNOWN');
        await visit(full, `${relative}/`);
      } else if (item.isFile()) {
        if (!allowed.includes(relative)) reject('ASSET_UNKNOWN');
        found.push(relative);
      } else reject('PATH_TYPE');
    }
  }
  await visit(directory);
  if (complete && allowed.some((file) => !found.includes(file))) reject('ASSET_MISSING');
  return found.sort();
}

// A bounded tokenizer for the static HTML subset in this tool. Comments cannot
// supply active metadata, and quoted '>' cannot end a tag early.
export function htmlElements(html) {
  const elements = [];
  let position = 0;
  while (position < html.length) {
    const start = html.indexOf('<', position);
    if (start < 0) break;
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      if (end < 0) reject('HTML_COMMENT');
      position = end + 3; continue;
    }
    if (/^<!doctype\s+html\s*>/i.test(html.slice(start))) {
      position = html.indexOf('>', start) + 1; continue;
    }
    let cursor = start + 1;
    const closing = html[cursor] === '/';
    if (closing) cursor++;
    const nameMatch = /^[A-Za-z][A-Za-z0-9:-]*/.exec(html.slice(cursor));
    if (!nameMatch) reject('HTML_TAG');
    const tag = nameMatch[0].toLowerCase(); cursor += nameMatch[0].length;
    const attributes = {};
    while (true) {
      while (/\s/.test(html[cursor] ?? '') && cursor < html.length) cursor++;
      if (html[cursor] === '>' || (html[cursor] === '/' && html[cursor + 1] === '>')) break;
      if (closing) reject('HTML_TAG');
      const attributeMatch = /^[A-Za-z_:][A-Za-z0-9_:.-]*/.exec(html.slice(cursor));
      if (!attributeMatch) reject('HTML_ATTRIBUTE');
      const key = attributeMatch[0].toLowerCase(); cursor += attributeMatch[0].length;
      if (Object.hasOwn(attributes, key)) reject('HTML_DUPLICATE_ATTRIBUTE');
      while (/\s/.test(html[cursor] ?? '') && cursor < html.length) cursor++;
      let value = '';
      if (html[cursor] === '=') {
        cursor++;
        while (/\s/.test(html[cursor] ?? '') && cursor < html.length) cursor++;
        const quote = html[cursor];
        if (quote === '"' || quote === "'") {
          const end = html.indexOf(quote, cursor + 1);
          if (end < 0) reject('HTML_ATTRIBUTE');
          value = html.slice(cursor + 1, end); cursor = end + 1;
        } else {
          const match = /^[^\s>"'<=`]+/.exec(html.slice(cursor));
          if (!match) reject('HTML_ATTRIBUTE');
          value = match[0]; cursor += value.length;
        }
      }
      attributes[key] = value;
    }
    const end = cursor + (html[cursor] === '/' ? 2 : 1);
    if (!closing) {
      const element = { tag, attributes, start, end };
      elements.push(element);
      if (tag === 'script') {
        const tail = /<\/script\s*>/ig; tail.lastIndex = end;
        const closingScript = tail.exec(html);
        if (!closingScript) reject('HTML_INLINE_SCRIPT');
        element.content = html.slice(end, closingScript.index);
        position = tail.lastIndex; continue;
      }
    }
    position = end;
  }
  return elements;
}

export function resolveLocal(reference, file) {
  if (!reference || /[\\\x00-\x20%&?#]/.test(reference)) reject('REFERENCE_FORMAT');
  let url;
  try { url = new URL(reference, `https://preview.invalid/${file}`); } catch { reject('REFERENCE_FORMAT'); }
  if (url.origin !== 'https://preview.invalid') reject('REFERENCE_EXTERNAL');
  const target = url.pathname.slice(1);
  if (!ASSETS.includes(target)) reject('REFERENCE_UNKNOWN');
  return target;
}

export function validateHTML(html, file, { production = false } = {}) {
  const elements = htmlElements(html);
  const locale = file === 'index.html' ? 'zh-Hant' : 'en';
  if (elements.filter(({ tag, attributes }) => tag === 'html' && attributes.lang === locale).length !== 1) reject('HTML_LOCALE');
  const robots = elements.filter(({ tag, attributes }) => tag === 'meta' && attributes.name?.toLowerCase() === 'robots');
  const notFound = file === '404.html';
  const expectedRobots = production && !notFound ? 'index,follow' : 'noindex,nofollow';
  if (robots.length !== 1 || robots[0].attributes.content?.toLowerCase() !== expectedRobots) reject(production ? 'PRODUCTION_ROBOTS' : 'PREVIEW_ROBOTS');
  const ids = elements.flatMap(({ attributes }) => attributes.id ? [attributes.id] : []);
  if (new Set(ids).size !== ids.length) reject('HTML_DUPLICATE_ID');
  const requiredIds = ['worksheet', 'entries', 'example', 'add', 'clear', 'calculate', 'status', 'errors', 'results', 'report', 'copy'];
  if (!notFound && requiredIds.some((id) => !ids.includes(id))) reject('HTML_CONTROL');
  const home = locale === 'en' ? 'https://glossquote.com/en/index.html' : 'https://glossquote.com/index.html';
  let appScript = false;
  let stylesheet = false;
  let homepage = false;
  let languageLink = false;
  for (const { tag, attributes: attrs, content } of elements) {
    if (['base', 'iframe', 'object', 'embed', 'style'].includes(tag)) reject('HTML_UNSAFE_TAG');
    if (notFound && ['script', 'form'].includes(tag)) reject('HTML_404');
    if (tag === 'meta' && Object.hasOwn(attrs, 'http-equiv')) reject('HTML_REFRESH');
    if (Object.keys(attrs).some((key) => /^on/i.test(key) || ['style', 'srcdoc', 'srcset', 'action', 'formaction', 'ping'].includes(key))) reject('HTML_UNSAFE_ATTRIBUTE');
    if (tag === 'form' && attrs.method && attrs.method.toLowerCase() !== 'get') reject('HTML_FORM_METHOD');
    const seoLink = tag === 'link' && ['canonical', 'alternate'].includes(attrs.rel);
    if (seoLink && (!production || notFound)) reject('PREVIEW_SEO');
    if (seoLink) {
      const expected = attrs.rel === 'canonical' ? CANONICAL[locale] : attrs.hreflang === 'x-default' ? CANONICAL['zh-Hant'] : CANONICAL[attrs.hreflang];
      if (!expected || attrs.href !== expected || Object.hasOwn(attrs, 'src')) reject('PRODUCTION_REFERENCE');
    }
    if (tag === 'meta' && attrs.property?.startsWith('og:') && (!production || notFound)) reject('PREVIEW_SEO');
    for (const attribute of ['src', 'href', 'poster', 'data']) {
      if (!Object.hasOwn(attrs, attribute)) continue;
      const value = attrs[attribute];
      if (seoLink && attribute === 'href') continue;
      if (tag === 'a' && attribute === 'href' && value === home) { homepage = true; continue; }
      if (tag === 'a' && attribute === 'href' && /^#[A-Za-z][A-Za-z0-9_-]*$/.test(value) && ids.includes(value.slice(1))) continue;
      const target = resolveLocal(value, file);
      if (tag === 'script' && (attribute !== 'src' || !target.endsWith('.mjs'))) reject('SCRIPT_REFERENCE');
      if (tag === 'link' && (attrs.rel !== 'stylesheet' || !target.endsWith('.css'))) reject('STYLE_REFERENCE');
      if (tag === 'script' && target === 'js/app.mjs' && attrs.type === 'module') appScript = true;
      if (tag === 'link' && target === 'styles/app.css') stylesheet = true;
      if (tag === 'a' && target === (locale === 'en' ? 'index.html' : 'en/index.html')) languageLink = true;
    }
    if (tag === 'script') {
      if (production && !notFound && attrs.type === 'application/ld+json' && !attrs.src) {
        if (content !== JSON_LD[locale]) reject('PRODUCTION_JSON_LD');
      } else {
        if (content?.trim()) reject('HTML_INLINE_SCRIPT');
        if (!attrs.src || attrs.type !== 'module') reject('HTML_SCRIPT');
      }
    }
  }
  if (!stylesheet || !homepage || (!notFound && (!appScript || !languageLink))) reject('HTML_REQUIRED_REFERENCE');
  if (!notFound) {
    const contentOf = (tag) => {
      const matches = elements.filter((entry) => entry.tag === tag);
      if (matches.length !== 1) reject('HTML_TITLE');
      const close = new RegExp(`<\\/${tag}\\s*>`, 'i').exec(html.slice(matches[0].end));
      if (!close) reject('HTML_TITLE');
      return html.slice(matches[0].end, matches[0].end + close.index).trim();
    };
    if (contentOf('title') !== escapeHTML(PAGE[locale].title) || contentOf('h1') !== PAGE[locale].name) reject('HTML_TITLE');
    const descriptions = elements.filter(({ tag, attributes }) => tag === 'meta' && attributes.name === 'description');
    if (descriptions.length !== 1 || descriptions[0].attributes.content !== escapeHTML(PAGE[locale].description)) reject('HTML_DESCRIPTION');
    if (elements.filter(({ tag }) => tag === 'h3').length < 5) reject('HTML_FAQ');
  }
  if (production && !notFound) {
    const canonical = elements.filter(({ tag, attributes }) => tag === 'link' && attributes.rel === 'canonical');
    const alternates = elements.filter(({ tag, attributes }) => tag === 'link' && attributes.rel === 'alternate');
    const ld = elements.filter(({ tag, attributes }) => tag === 'script' && attributes.type === 'application/ld+json');
    if (canonical.length !== 1 || alternates.length !== 3 || ld.length !== 1 ||
        new Set(alternates.map(({ attributes }) => attributes.hreflang)).size !== 3) reject('PRODUCTION_META');
    const expectedOG = { 'og:type': 'website', 'og:title': escapeHTML(PAGE[locale].title), 'og:description': escapeHTML(PAGE[locale].description), 'og:url': CANONICAL[locale], 'og:locale': PAGE[locale].ogLocale, 'og:locale:alternate': PAGE[locale].otherOgLocale };
    const og = elements.filter(({ tag, attributes }) => tag === 'meta' && attributes.property?.startsWith('og:'));
    if (og.length !== Object.keys(expectedOG).length || new Set(og.map(({ attributes }) => attributes.property)).size !== og.length ||
        og.some(({ attributes }) => attributes.content !== expectedOG[attributes.property])) reject('PRODUCTION_OG');
  }
}

function shape(value) {
  return Object.keys(value).sort().map((key) => `${key}:${value[key] && typeof value[key] === 'object' ? shape(value[key]) : typeof value[key]}`).join('|');
}

export async function validatePublic(root = PROJECT_ROOT, { syntax = false } = {}) {
  await assertSafePath(root);
  const publicRoot = path.join(root, 'public');
  return validateDirectory(publicRoot, { syntax });
}

export async function validateDirectory(publicRoot, { syntax = false, production = false } = {}) {
  const files = await validateTree(publicRoot, { allowed: production ? PRODUCTION_ASSETS : ASSETS });
  if (shape(copy.en) !== shape(copy['zh-Hant'])) reject('LOCALE_PARITY');
  for (const file of files) {
    const full = path.join(publicRoot, file);
    const source = await readFile(full, 'utf8');
    if (file.endsWith('.html')) validateHTML(source, file, { production });
    if (file === 'robots.txt' && source !== (production ? PRODUCTION_ROBOTS : PREVIEW_ROBOTS)) reject(production ? 'PRODUCTION_ROBOTS' : 'PREVIEW_ROBOTS');
    if (file === '_headers' && source !== headersText(production)) reject('HEADERS_CONTRACT');
    if (file === 'sitemap.xml' && source !== SITEMAP) reject('PRODUCTION_SITEMAP');
    if (file.endsWith('.css') && /@import|url\s*\(/i.test(source)) reject('CSS_NETWORK');
    if (file.endsWith('.mjs')) {
      if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|serviceWorker|caches|eval|Function|innerHTML|outerHTML|insertAdjacentHTML|execCommand|readText|cookie|console)\b|Date\.parse|valueAsNumber/.test(source)) reject('SCRIPT_UNSAFE_API');
      if (/\bimport\s*\(/.test(source)) reject('SCRIPT_DYNAMIC_IMPORT');
      const imports = source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g);
      for (const match of imports) {
        if (!match[1].startsWith('./') && !match[1].startsWith('../')) reject('SCRIPT_IMPORT');
        if (!resolveLocal(match[1], file).endsWith('.mjs')) reject('SCRIPT_IMPORT');
      }
      if (syntax) {
        const checked = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8', windowsHide: true });
        if (checked.status !== 0) reject('SCRIPT_SYNTAX');
      }
    }
  }
  return files;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
export async function validateWorkerConfig(root = PROJECT_ROOT) {
  const file = path.join(root, 'wrangler.jsonc');
  await assertSafePath(file);
  let config;
  try { config = JSON.parse(await readFile(file, 'utf8')); } catch { reject('WORKER_CONFIG'); }
  if (JSON.stringify(stable(config)) !== JSON.stringify(stable(WORKER_CONFIG))) reject('WORKER_CONFIG');
  return config;
}
