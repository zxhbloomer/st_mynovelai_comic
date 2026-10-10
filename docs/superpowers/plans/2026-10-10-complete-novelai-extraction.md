# Complete NovelAI Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Copy all LittleWhiteBox NovelAI behavior into 花漫画 as a standalone SillyTavern extension plus server plugin, preserving the source UI and behavior while removing LittleWhiteBox runtime coupling.

**Architecture:** The browser extension will use the LittleWhiteBox NovelAI UI, floating panel, floor controls, presets, gallery, prompt guides, and state machine as the source implementation. A small host adapter will provide only SillyTavern APIs and the independent `sillytavern-novelai` HTTP boundary. The server plugin will retain the extracted NovelAI providers, V5 stream parser, image jobs, and draw-run routes.

**Tech Stack:** SillyTavern 1.19.0 extension manifest, browser ES modules, Node.js CommonJS server plugin, existing offline smoke tests.

**Spec:** `docs/2026-10-10-standalone-novelai-plugin-design.md`, `docs/2026-10-10-novelai-inventory.md`, and the source tree at `D:/game/tools/github/LittleWhiteBox-main/modules/draw/providers/novelai`.

## Global Constraints

- The source of truth for NovelAI behavior and UI is LittleWhiteBox; no invented replacement UI.
- The runtime must not import LittleWhiteBox paths, globals, event buses, or shared modules.
- The extension must install from a Git URL with a root `manifest.json`.
- The server plugin must load from `plugins/sillytavern-novelai` with `info`, `init`, and `exit` exports.
- All project documentation stays under `docs/`.
- Real-host and real-API acceptance remain separate from offline tests.

## Review Focus

- Every source NovelAI file is represented in the standalone tree or explicitly marked as an unresolved host dependency.
- The copied floating panel has the same controls, labels, drag behavior, and state transitions as the source.
- Source imports are either copied dependencies or replaced by a documented host adapter.
- Third-party Git installation resolves every browser module from the cloned repository.
- V5 MessagePack, ZIP responses, cancellation, and async jobs preserve source behavior.

---

### Task 1: Freeze the source inventory

**Files:**
- Modify: `docs/2026-10-10-novelai-inventory.md`
- Create: `docs/2026-10-10-novelai-dependency-map.md`
- Test: `tests/novelai/source-inventory-smoke.test.mjs`

- [ ] Enumerate every NovelAI source file, import, asset, fixture, and test from LittleWhiteBox.
- [ ] Classify each dependency as copied, host-adapted, server-owned, or blocked.
- [ ] Add a smoke test that fails when an inventory source file has no destination classification.

### Task 2: Restore source-faithful browser UI

**Files:**
- Modify: `public/scripts/extensions/novelai/novel-draw.js`
- Modify: `public/scripts/extensions/novelai/floating-panel.js`
- Modify: `public/scripts/extensions/novelai/cloud-presets.js`
- Modify: `public/scripts/extensions/novelai/novel-draw.html`
- Modify: `public/scripts/extensions/novelai/style.css`

- [ ] Copy the source implementations and their exact labels, controls, layout, drag handling, and state transitions.
- [ ] Remove the temporary simplified 花漫画 controls that replaced the source UI.
- [ ] Keep source behavior intact while routing API calls through the independent transport adapter.
- [ ] Add browser-facing fixtures for panel creation, control presence, and lifecycle cleanup.

### Task 3: Replace host imports with a narrow adapter

**Files:**
- Create: `public/scripts/extensions/novelai/host-adapter.js`
- Modify: copied NovelAI browser modules that currently import LittleWhiteBox host/shared modules
- Test: `tests/novelai/host-adapter-smoke.test.mjs`

- [ ] Implement exact adapter functions required by the copied source imports.
- [ ] Replace LittleWhiteBox imports one by one; do not replace behavior with stubs that silently succeed.
- [ ] Make unresolved capabilities fail visibly with the same user-facing error boundary.
- [ ] Verify the third-party cloned path and direct installed path both resolve imports.

### Task 4: Connect complete UI to the independent server plugin

**Files:**
- Modify: `public/scripts/extensions/novelai/runtime.js`
- Modify: `public/scripts/extensions/novelai/core/*`
- Modify: `server-plugin/sillytavern-novelai/*`
- Test: existing NovelAI smoke suite plus route and transport fixtures

- [ ] Route Legacy/V4/V4.5, V5 stream, async image jobs, draw runs, cancellation, and connection tests through the independent plugin API.
- [ ] Preserve source result decoding, gallery insertion, recovery, and floor state transitions.
- [ ] Keep browser direct mode only where the source and browser protocol support it.

### Task 5: Package both SillyTavern installation surfaces

**Files:**
- Modify: root `manifest.json`, `install.ps1`, `README.md`
- Test: `tests/novelai/install-layout-smoke.test.mjs`

- [ ] Verify Git URL installation sees the root manifest and loads the copied browser entry.
- [ ] Verify `install.ps1` deploys the server plugin and browser assets without LittleWhiteBox.
- [ ] Document that extension-manager installation and server-plugin installation are separate steps.

### Task 6: Acceptance gates and release

- [ ] Run all offline tests and full JavaScript syntax checks.
- [ ] Run a clean SillyTavern 1.19.0 installation smoke test.
- [ ] Run real NovelAI Legacy/V4.5 and V5 generation with a user-provided key.
- [ ] Audit the final tree for LittleWhiteBox runtime references.
- [ ] Update the coverage audit with evidence and remaining gaps.
- [ ] Commit and push only after the gates pass.
