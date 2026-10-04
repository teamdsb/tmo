import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('..', import.meta.url));
const dist = path.resolve(process.argv[2] || path.join(app, 'dist'));
const pages = (await readdir(dist)).filter(name => name.endsWith('.html'));
assert(pages.length > 0, 'Build admin-web before checking its production assets');
for (const name of pages) {
  const html = await readFile(path.join(dist, name), 'utf8');
  assert(!/<(?:script|link)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//i.test(html), `${name} references a runtime CDN`);
  assert(/<link\b[^>]*rel="stylesheet"/.test(html), `${name} has no compiled stylesheet`);
}
for (const [packageName, filename] of [['inter', 'Inter-OFL.txt'], ['material-symbols-outlined', 'Material-Symbols-Outlined-OFL.txt']]) {
  const published = await readFile(path.join(dist, 'licenses', filename), 'utf8');
  const original = await readFile(path.join(app, 'node_modules', '@fontsource-variable', packageName, 'LICENSE'), 'utf8');
  assert.equal(published, original, `${filename} must retain the full font copyright and license`);
}
const files = await readdir(path.join(dist, 'assets'));
assert(files.some(name => name.startsWith('inter-') && name.endsWith('.woff2')), 'Inter font must be bundled');
assert(files.some(name => name.startsWith('material-symbols-outlined-latin-full-normal') && name.endsWith('.woff2')), 'Full-axis Material Symbols font must be bundled');
console.log(`Verified ${pages.length} HTML entries, local fonts, and both complete OFL notices.`);
