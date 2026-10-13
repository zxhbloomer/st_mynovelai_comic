import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../../modules/draw/providers/novelai/floating-panel.js', import.meta.url), 'utf8');
assert.match(source, /nd-btn-reader/);
assert.match(source, /openComicReaderForFloor/);
assert.match(source, /createComicReader/);
console.log('comic reader toolbar: ok');
