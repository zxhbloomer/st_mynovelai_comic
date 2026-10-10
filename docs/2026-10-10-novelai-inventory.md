# NovelAI Migration Inventory

This inventory freezes the observed NovelAI behavior boundary in
`D:/game/tools/github/LittleWhiteBox-main` for the standalone SillyTavern
plugin. A row is verified only when its source file, export, or test was
inspected. Anything absent from this list is an explicit coverage gap.

## Provider modules

| Source | Responsibility | Destination task | Status |
|---|---|---|---|
| `modules/draw/providers/novelai/novel-draw.js` | lifecycle, settings, generation orchestration, host wiring, image insertion | 4–7 | verified; imports 34 host/shared modules |
| `modules/draw/providers/novelai/floating-panel.js` | floor/floating controls and progress UI | 6 | verified |
| `modules/draw/providers/novelai/compiler.js` | legacy/V4/V4.5/V5 request compilation | 2 | verified |
| `modules/draw/providers/novelai/novel-request-config.js` | transport, endpoint, probe, config snapshot | 2–3 | verified |
| `modules/draw/providers/novelai/novel-v5-request.js` | V5 quality/UC presets and request body | 2–3 | verified |
| `modules/draw/providers/novelai/novel-v5-stream.js` | V5 stream response and error decoding | 2–3 | verified |
| `modules/draw/providers/novelai/novel-image-response.js` | ZIP/multi-image/base64 response handling | 2 | verified |
| `modules/draw/providers/novelai/novel-model-capabilities.js` | model IDs, transport and limits | 2 | verified |
| `modules/draw/providers/novelai/novel-prompts.js` | guides, templates and prompt chain | 2, 5 | verified |
| `modules/draw/providers/novelai/novel-prompt-import.js` | preset import parsing | 5 | verified |
| `modules/draw/providers/novelai/novel-prompt-migration.js` | legacy settings migration | 2, 5 | verified |
| `modules/draw/providers/novelai/cloud-presets.js` | cloud preset list/download/import/export UI | 5 | verified |
| `modules/draw/providers/novelai/novel-character-learning.js` | character tag matching/learning | 7 | verified |
| `modules/draw/providers/novelai/novel-backend-job-result.js` | backend result capability/decode | 3, 6 | verified |
| `modules/draw/providers/novelai/*.md` | V4.5/V5 prompt guides | 1, 5 | verified |

## Server transport

| Source | Responsibility | Destination |
|---|---|---|
| `server-plugin/littlewhitebox-image-jobs/providers/novelai/adapter.js` | provider job adapter | Task 3 |
| `server-plugin/littlewhitebox-image-jobs/providers/novelai/client.js` | NovelAI HTTP client | Task 3 |
| `server-plugin/littlewhitebox-image-jobs/providers/novelai/v5-stream.js` | server V5 stream transport | Task 3 |
| `server-plugin/littlewhitebox-image-jobs/providers/novelai/vendor/novel-v5-parser.cjs` | bundled MessagePack parser | Task 3 |
| `server-plugin/littlewhitebox-image-jobs/providers/novelai/vendor/THIRD_PARTY_LICENSES.txt` | vendor notices | Task 1, 3 |

## Required shared runtime behavior

`novel-draw.js` directly imports or calls the following shared domains and
they must be reimplemented behind the new host adapter: character selection
and prompts, scene planning and worldbook processing, serial image queue,
backend/recoverable image jobs, draw-run controls/recovery/UI state, image
marker syntax and scene placement, prepared chat images, floor image jobs,
request outcome tracking, image-card redraw/actions, card tag editing,
gallery cache, preview rendering, and message toolbar registration.

These are required for behavioral compatibility even though they are not
NovelAI protocol code. Agent Core and other providers remain excluded unless
an inventory row proves a NovelAI feature cannot work without a replacement
interface.

## Fixtures and tests

The provider test set contains cloud presets, backend results, character
learning, image responses, model capabilities, prompt guides/import/migration,
request config, V5 request, and V5 stream tests. Fixtures include parameter
presets, settings templates, scene-rule templates, and upstream settings.
The migration must preserve equivalent cases and add host/server adapter
cases; passing a copied test without removing LittleWhiteBox imports is not
acceptance.

## Known gaps

- License compatibility of every copied or bundled vendor artifact requires
  review before packaging.
- NovelAI V5 protocol behavior is fixture-backed rather than guaranteed by
  public Swagger and may change upstream.
- Real-host behavior, CORS/TLS, browser refresh recovery, and credentialed
  generation remain unverified until Task 8.
