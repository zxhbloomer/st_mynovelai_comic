import assert from 'node:assert/strict';
import { compileNovelImageRequest } from '../../modules/novelai/core/compiler.js';
import { resolveNovelImageTransport } from '../../public/scripts/extensions/novelai/core/novel-request-config.js';
assert.equal(resolveNovelImageTransport({ sendMode: 'frontend', useImageBackendJobs: true }), 'frontend');
assert.equal(resolveNovelImageTransport({ sendMode: 'backend', useImageBackendJobs: false }), 'backend');
assert.equal(resolveNovelImageTransport({ sendMode: 'backend', useImageBackendJobs: true }), 'backend-job');
console.log('novelai transport mode smoke: ok');
