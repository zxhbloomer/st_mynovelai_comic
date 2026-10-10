import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDrawRunManager } = require('../../server-plugin/sillytavern-novelai/draw-runs/draw-run-manager.js');

test('backend handoff retains original NovelAI source after releasing planner input', async () => {
    const manager = createDrawRunManager({
        runtime: {
            executePreparedScenePlanner: async () => [{ scene: 'tags' }],
            compileDrawRunImages: () => ({ provider: 'novelai', items: [{}],
                artifacts: [{ task: { scene: 'tags', placement: { insertAfter: 1 } }, promptData: { scene: 'tags' } }] }),
            deriveDrawRunChildJobId: () => 'child',
            deriveDrawRunItemIds: () => ({ slotId: 'slot', imgId: 'image' }),
        },
        agentCore: { createAgentAdapter() {} },
        envelopeValidator: envelope => ({ envelope, inputBytes: 1 }),
        imageJobService: { create() {}, get: () => ({}), cancel() {} },
        createHostClient() {}, childSweepIntervalMs: 0,
    });
    try {
        manager.create('owner', { runId: 'run', sourceHash: 'hash', imageProvider: 'novelai',
            planner: { validationContext: { sceneSource: { sourceText: '生图时的原始描述', points: [{ offset: 3 }] } } },
            agent: { channel: 'custom', providerConfig: {} }, generationRecipe: {} });
        await new Promise(resolve => setImmediate(resolve));
        const result = manager.get('owner', 'run');
        assert.equal(result.state, 'dispatched');
        assert.equal(result.handoffManifest.items[0].displayMetadata.plannerSourceText, '生图时的原始描述');
        assert.equal(result.handoffManifest.items[0].displayMetadata.plannerSourceOrigin, 'captured');
    } finally {
        manager.close();
    }
});
