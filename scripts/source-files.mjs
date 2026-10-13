import { ASSETS } from './validation.mjs';

export const SOURCE_FILES = Object.freeze([
  '.gitignore', 'package.json', 'project.json', 'wrangler.jsonc', 'AGENTS.md', 'START-HERE.md', 'TASK-ENTRY.md',
  'PRODUCT.md', 'TECHNICAL.md', 'UX-SEO.md', 'ACCEPTANCE.md', 'TASKS.md', 'HANDOFF.md', 'README.md',
  'docs/ENGINEERING.md', 'docs/PRIVACY-SECURITY.md', 'docs/DESIGN-SYSTEM.md', 'docs/BRAND.md',
  'docs/RELEASE.md', 'docs/RELEASE-CANDIDATE.md',
  ...ASSETS.map((file) => `public/${file}`),
  'scripts/validation.mjs', 'scripts/serve.mjs', 'scripts/check.mjs', 'scripts/build.mjs', 'scripts/manifest.mjs',
  'scripts/release-contract.mjs', 'scripts/dry-run.mjs', 'scripts/source-files.mjs', 'scripts/source-archive.mjs',
  'test/work-hours.test.mjs', 'test/ui-contract.test.mjs', 'test/tooling.test.mjs', 'test/release.test.mjs'
].sort());
