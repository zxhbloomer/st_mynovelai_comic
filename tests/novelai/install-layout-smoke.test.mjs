import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const required = [
    'public/scripts/extensions/novelai/manifest.json',
    'public/scripts/extensions/novelai/index.js',
    'server-plugin/sillytavern-novelai/manifest.json',
    'server-plugin/sillytavern-novelai/index.js',
    'server-plugin/sillytavern-novelai/package.json',
];
for (const relative of required) assert.equal(fs.existsSync(path.join(root, relative)), true, relative);
const extensionManifest = JSON.parse(fs.readFileSync(path.join(root, required[0]), 'utf8'));
assert.equal(extensionManifest.js, 'index.js');
assert.equal(extensionManifest.hooks.activate, 'initNovelAIExtension');
const pluginManifest = JSON.parse(fs.readFileSync(path.join(root, required[2]), 'utf8'));
assert.equal(pluginManifest.id, 'sillytavern-novelai');
console.log('novelai install layout smoke: ok');
