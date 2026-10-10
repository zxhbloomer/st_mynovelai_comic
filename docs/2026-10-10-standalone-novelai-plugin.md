# Standalone NovelAI Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the complete NovelAI behavior currently implemented in LittleWhiteBox as an independently installable SillyTavern browser extension plus server plugin with no LittleWhiteBox runtime dependency.

**Architecture:** Freeze a source inventory first, then implement a dependency-free protocol core shared by browser and server bundles. Add a SillyTavern server plugin for proxy/V5/jobs and a browser extension for settings, generation, floor/floating controls, cache/gallery, and host integration. Internal milestones reduce risk while preserving the single complete delivery scope.

**Tech Stack:** SillyTavern ES modules, browser DOM APIs, Node.js 20+, Express router through the existing server-plugin loader, project test tooling, deterministic JSON/binary fixtures.

**Spec:** `project/st_mynovelai_comic/docs/2026-10-10-standalone-novelai-plugin-design.md`

## Global Constraints

- Runtime must not import, resolve, execute, or call LittleWhiteBox.
- All NovelAI behavior must be represented in the frozen inventory; unverified behavior is recorded as a gap.
- Pure protocol modules have no DOM, Express, or SillyTavern globals.
- API keys are never written to logs or fixtures.
- Server jobs are process-local and are cleared on restart.
- Plugin absence is explicit and never silently redirected to LittleWhiteBox.

## Review Focus

- V5 stream truncation or malformed frames: parser returns a stable protocol error and never emits partial PNG as final.
- Invalid model/size/seed/config values: compiler rejects or normalizes deterministically with no network request.
- Plugin disabled or unavailable: UI exposes direct/proxy capability state and actionable error.
- Cancel/timeout/retry races: one terminal result, resources released, no duplicate floor insertion.
- Cache/gallery corruption or quota failure: generation result remains recoverable and UI reports storage failure.

### Task 1: Freeze NovelAI behavior inventory and provenance

**Files:**
- Create: `project/st_mynovelai_comic/docs/2026-10-10-novelai-inventory.md`
- Create: `docs/superpowers/specs/2026-10-10-novelai-provenance.md`
- Test: `docs/superpowers/specs/2026-10-10-novelai-inventory.json`

**Interfaces:**
- Produces the authoritative list of source paths, exports, call chains, fixtures, third-party code, and migration status used by all later tasks.

- [ ] Enumerate every NovelAI source, test, fixture, build artifact, and server route in LittleWhiteBox.
- [ ] Classify each item as pure core, host adapter, UI, server transport, fixture, or excluded dependency; record verified versus inferred behavior.
- [ ] Record licenses and third-party notices and define the no-copy/rewrite boundary.
- [ ] Add a machine-readable inventory and a check that every claimed behavior has a mapped destination task.
- [ ] Run the inventory checker and record explicit gaps.

### Task 2: Build pure protocol and configuration core

**Files:**
- Create: `public/scripts/extensions/novelai/core/model-capabilities.js`
- Create: `public/scripts/extensions/novelai/core/request-config.js`
- Create: `public/scripts/extensions/novelai/core/compiler.js`
- Create: `public/scripts/extensions/novelai/core/image-response.js`
- Create: `public/scripts/extensions/novelai/core/config-migration.js`
- Create: `public/scripts/extensions/novelai/core/errors.js`
- Test: `tests/novelai/core/*.test.js`

**Interfaces:**
- Produces `compileImageRequest(input, recipe, seed)`, `compileScenePlan(plan, recipe)`, `decodeImageResponse(response)`, `normalizeConfig(value)`, and stable error categories.

- [ ] Port fixtures and write failing tests for legacy, V4, V4.5, model capability selection, size/seed normalization, migration, and response decoding.
- [ ] Implement deterministic compilers and migration without host imports.
- [ ] Add malformed payload and provider-error tests.
- [ ] Run the focused core test command and verify all fixtures pass.

### Task 3: Implement standalone server plugin transport

**Files:**
- Create: `plugins/sillytavern-novelai/package.json`
- Create: `plugins/sillytavern-novelai/index.mjs`
- Create: `plugins/sillytavern-novelai/routes/*.mjs`
- Create: `plugins/sillytavern-novelai/transport/*.mjs`
- Create: `plugins/sillytavern-novelai/jobs/*.mjs`
- Test: `plugins/sillytavern-novelai/tests/*.test.js`

**Interfaces:**
- Routes: `/status`, `/v1/test`, `/v1/generate-image`, `/v1/generate-image-stream`, `/v1/jobs`, `/v1/jobs/:id`, `/v1/jobs/:id/result`, `/v1/jobs/:id/cancel`.
- Job states: `queued`, `running`, `ready`, `error`, `cancelled`, `expired`.

- [ ] Write route validation, capability, job-state, cancellation, timeout, and credential-redaction tests.
- [ ] Implement plugin metadata and route registration compatible with `src/plugin-loader.js`.
- [ ] Implement legacy transport and error mapping.
- [ ] Port V5 MessagePack framing/terminal parsing using isolated vendor code and notices from Task 1.
- [ ] Implement bounded in-memory jobs, cleanup, result limits, and cancellation.
- [ ] Run plugin tests with mocked NovelAI endpoints.

### Task 4: Create SillyTavern host adapter and extension lifecycle

**Files:**
- Create: `public/scripts/extensions/novelai/manifest.json`
- Create: `public/scripts/extensions/novelai/index.js`
- Create: `public/scripts/extensions/novelai/host/*.js`
- Test: `tests/novelai/host/*.test.js`

- [ ] Pin the target checkout's extension APIs, settings storage, request headers, character/worldbook reads, image save, and message insertion in adapter tests.
- [ ] Implement namespaced settings, import/migration entry, plugin capability probe, and direct/proxy transport selection.
- [ ] Verify extension discovery and reload in a mocked SillyTavern host.

### Task 5: Migrate complete settings and prompt UI

**Files:**
- Create: `public/scripts/extensions/novelai/ui/novel-draw.html`
- Create: `public/scripts/extensions/novelai/ui/settings.js`
- Create: `public/scripts/extensions/novelai/ui/styles.css`
- Create: `public/scripts/extensions/novelai/ui/presets.js`
- Test: `tests/novelai/ui/settings.test.js`

- [ ] Reproduce all settings sections, model/parameter controls, prompt guide/import/export, connection test, and visible backend capability state.
- [ ] Add UI tests for save/reload, invalid values, migration warnings, and plugin absence.
- [ ] Verify the screenshot-referenced quick-test flow using mocked transport.

### Task 6: Migrate generation controls, floor insertion, floating panel, and state machine

**Files:**
- Create: `public/scripts/extensions/novelai/ui/generation.js`
- Create: `public/scripts/extensions/novelai/ui/floating-panel.js`
- Create: `public/scripts/extensions/novelai/ui/floor-controls.js`
- Create: `public/scripts/extensions/novelai/ui/progress-state.js`
- Test: `tests/novelai/ui/generation.test.js`

- [ ] Write tests for serialized requests, progress states, cancellation, cooldown, retry, partial failure, and duplicate-insertion prevention.
- [ ] Implement generation orchestration against the transport interface and host adapter.
- [ ] Implement floor and floating controls with accessible labels, keyboard operation, persisted position, and actionable errors.
- [ ] Run browser-mocked tests and a local SillyTavern preview.

### Task 7: Implement preview cache, gallery, saved images, and character learning

**Files:**
- Create: `public/scripts/extensions/novelai/storage/*.js`
- Create: `public/scripts/extensions/novelai/ui/gallery.js`
- Create: `public/scripts/extensions/novelai/character-learning.js`
- Test: `tests/novelai/storage/*.test.js`, `tests/novelai/character-learning.test.js`

- [ ] Define versioned schemas, file naming, TTL, quota behavior, deletion/selection semantics, and migration tests.
- [ ] Implement cache/gallery operations and recoverable storage failures.
- [ ] Port NovelAI-specific tag learning against explicit SillyTavern character data with `new_only` and `auto_update` behavior.
- [ ] Verify gallery and learning do not require LittleWhiteBox data stores.

### Task 8: Package, audit, and real-host acceptance

**Files:**
- Modify: `project/st_mynovelai_comic/docs/2026-10-10-novelai-inventory.md`
- Create: `plugins/sillytavern-novelai/README.md`
- Create: `public/scripts/extensions/novelai/README.md`
- Test: `tests/novelai/acceptance/*.test.js`

- [ ] Run lint and all focused/core/server/browser tests.
- [ ] Scan imports and packaged files to prove no LittleWhiteBox path or runtime dependency remains.
- [ ] Install into a clean SillyTavern checkout, verify extension discovery and server plugin loading, then perform credentialed legacy and V5 generation.
- [ ] Verify restart clears jobs, plugin-disabled behavior is explicit, and generated images insert into messages.
- [ ] Record untested boundaries and final inventory status before release packaging.

## Execution order

Tasks are sequential because each later boundary depends on the interfaces and
fixtures frozen by the previous task. The final delivery is one complete
plugin package; the task boundaries are internal verification gates, not
reduced-scope releases.

