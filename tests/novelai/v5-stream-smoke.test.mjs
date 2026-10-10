import assert from 'node:assert/strict';
import { readNovelV5FinalImage } from '../../modules/draw/providers/novelai/novel-v5-stream.js';
const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([0, 0, 0, 8, 0x81])); controller.close(); } }), { headers: { 'content-type': 'application/octet-stream' } });
await assert.rejects(() => readNovelV5FinalImage(response), /截断|解析|结束|MessagePack|final/i);
console.log('novelai v5 stream truncation smoke: ok');


