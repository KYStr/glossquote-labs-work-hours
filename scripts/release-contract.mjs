import { createHash } from 'node:crypto';

export const ORIGIN = 'https://hours.glossquote.com';
export const CANONICAL = Object.freeze({ 'zh-Hant': `${ORIGIN}/index.html`, en: `${ORIGIN}/en/index.html` });
export const PAGE = Object.freeze({
  'zh-Hant': Object.freeze({
    name: '工時加總', title: '工時加總：扣除休息、跨日與每日小計 | GlossQuote',
    description: '填入工作日期、開始與結束時間及休息分鐘，在瀏覽器本機加總每段、每天與整批工時。支援跨日並提醒重疊時段，無需帳號。',
    ogLocale: 'zh_TW', otherOgLocale: 'en_US'
  }),
  en: Object.freeze({
    name: 'Work Hours Calculator', title: 'Work Hours Calculator: Breaks & Overnight Shifts | GlossQuote',
    description: 'Add work intervals and deduct breaks locally in your browser. See entry, daily and total hours, handle overnight shifts and catch overlapping entries without an account.',
    ogLocale: 'en_US', otherOgLocale: 'zh_TW'
  })
});
export const escapeHTML = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const JSON_LD = Object.freeze(Object.fromEntries(Object.keys(PAGE).map((locale) => [locale, JSON.stringify({
  '@context': 'https://schema.org', '@type': 'WebApplication', name: PAGE[locale].name,
  url: CANONICAL[locale], inLanguage: locale, applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web', description: PAGE[locale].description
})])));
export const LD_HASHES = Object.freeze(Object.values(JSON_LD).map((source) => `'sha256-${createHash('sha256').update(source).digest('base64')}'`));
export const BASE_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export const PRODUCTION_CSP = BASE_CSP.replace("script-src 'self'", `script-src 'self' ${LD_HASHES.join(' ')}`);
export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': BASE_CSP,
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store'
});
export function headersText(production = false) {
  const values = { ...SECURITY_HEADERS, 'Content-Security-Policy': production ? PRODUCTION_CSP : BASE_CSP };
  if (!production) values['X-Robots-Tag'] = 'noindex, nofollow';
  return `/*\n${Object.entries(values).map(([name, value]) => `  ${name}: ${value}`).join('\n')}\n${production ? '\n/404.html\n  X-Robots-Tag: noindex, nofollow\n' : ''}`;
}
export const PREVIEW_ROBOTS = 'User-agent: *\nDisallow: /\n';
export const PRODUCTION_ROBOTS = `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`;
export const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${CANONICAL['zh-Hant']}</loc></url>\n  <url><loc>${CANONICAL.en}</loc></url>\n</urlset>\n`;
export const WORKER_CONFIG = Object.freeze({
  name: 'glossquote-labs-work-hours', compatibility_date: '2026-10-13', workers_dev: false, preview_urls: false,
  assets: Object.freeze({ directory: './dist', html_handling: 'none', not_found_handling: '404-page' }),
  routes: Object.freeze([Object.freeze({ pattern: 'hours.glossquote.com', custom_domain: true })]),
  observability: Object.freeze({ enabled: false, logs: Object.freeze({ enabled: false }), traces: Object.freeze({ enabled: false }) })
});

export function productionHead(locale) {
  const page = PAGE[locale];
  return [
    '<meta name="robots" content="index,follow">',
    `<link rel="canonical" href="${CANONICAL[locale]}">`,
    `<link rel="alternate" hreflang="zh-Hant" href="${CANONICAL['zh-Hant']}">`,
    `<link rel="alternate" hreflang="en" href="${CANONICAL.en}">`,
    `<link rel="alternate" hreflang="x-default" href="${CANONICAL['zh-Hant']}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHTML(page.title)}">`,
    `<meta property="og:description" content="${escapeHTML(page.description)}">`,
    `<meta property="og:url" content="${CANONICAL[locale]}">`,
    `<meta property="og:locale" content="${page.ogLocale}">`,
    `<meta property="og:locale:alternate" content="${page.otherOgLocale}">`,
    `<script type="application/ld+json">${JSON_LD[locale]}</script>`
  ].join('\n  ');
}
