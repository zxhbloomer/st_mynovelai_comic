# NovelAI export coverage audit

Generated from source export inspection. This is not a completion claim.

| Source module | Important exports observed | Independent project status |
|---|---|---|
| compiler.js | buildNovelAIRequestBody, compileNovelPromptForTask, compileNovelImageRequest, compile | migrated and smoke-tested |
| novel-model-capabilities.js | model IDs/capabilities and UI helpers | migrated and smoke-tested |
| novel-v5-request.js | V5 presets, request builder, probe builder | migrated and smoke-tested |
| novel-request-config.js | snapshot, transport, endpoint and probe helpers | migrated |
| novel-image-response.js | response and ZIP/multi-image decoding | migrated; browser fixture still pending |
| novel-prompt-import.js | preset import parser | migrated and smoke-tested |
| novel-prompt-migration.js | legacy prompt migration | migrated and smoke-tested |
| novel-character-learning.js | auto-learning resolver | migrated and smoke-tested |
| novel-prompts.js | guides, templates, planner profile | migrated with local loader; host UI integration pending |
| cloud-presets.js | cloud list/download/import/export UI | copied; host integration pending |
| floating-panel.js | complete floor/floating state machine | copied; old host imports still need replacement |
| novel-draw.js | full lifecycle, floor jobs, gallery, recovery, host wiring | copied; old host imports still need replacement |
| novel-v5-stream.js | browser MessagePack stream reader | copied; browser runtime integration pending |
| novel-backend-job-result.js | async backend result decoder | copied; job UI integration pending |

## Remaining completion gates

- Replace all old host/shared imports in `novel-draw.js` and `floating-panel.js`.
- Integrate browser V5 stream and async-job result paths with the independent transport.
- Finish cloud preset, gallery selection, recovery, and floor-state UI behavior.
- Run the extension in a clean SillyTavern instance with a real NovelAI credential.
- Package and scan the final tree for LittleWhiteBox runtime references.
