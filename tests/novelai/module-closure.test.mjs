import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const visited = new Set();
const missing = [];
function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    if (!fs.existsSync(file)) { missing.push(path.relative(root, file)); return; }
    const text = fs.readFileSync(file, 'utf8');
    const imports = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"\n]+)['"]/g)];
    for (const [, specifier] of imports) {
        if (specifier.startsWith('.')) {
            const resolved = path.resolve(path.dirname(file), specifier);
            if (resolved.startsWith(root)) visit(resolved);
        }
        else if (specifier.includes('/') || specifier.endsWith('.js')) {
            assert(specifier.startsWith('/scripts/') || specifier === '/script.js', `Unexpected runtime import ${specifier} in ${file}`);
        }
    }
}
visit(path.join(root, 'index.js'));
assert.deepEqual(missing, [], `Unresolved browser modules: ${missing.join(', ')}`);
console.log(`Browser module closure: ${visited.size} files resolved`);
