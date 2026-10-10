import assert from 'node:assert/strict';
const plugin = await import('../../server-plugin/sillytavern-novelai/index.js');
assert.equal(plugin.info.id, 'sillytavern-novelai');
assert.equal(typeof plugin.init, 'function');
assert.equal(typeof plugin.exit, 'function');
console.log('novelai plugin smoke: ok');
