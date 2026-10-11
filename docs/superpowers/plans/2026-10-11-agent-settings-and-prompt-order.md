# Agent Settings and Prompt Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add prompt-group reordering, full-width folded image rows, provider-aware request body parameters, and configurable LLM timeout without changing the paused `setvar/getvar` scope.

**Architecture:** Keep one visible control for the currently selected Agent Provider, while storing its value inside that provider's existing preset configuration. Pass normalized request-body parameters and timeout through the existing Agent config and adapter call; do not append parameters to prompt text. Keep image rendering changes scoped to the existing image card.

**Tech Stack:** Browser JavaScript/HTML/CSS, ES modules, Node test runner, existing Agent adapter and Playwright harness.

**Spec:** `docs/2026-10-11-三种LLM生图模式需求.md` section 24.

## Global Constraints

- Preserve the paused `setvar/getvar` requirement.
- Do not modify or commit the local `提示词/` directory.
- Store request parameters per Agent preset and Provider; display only the current Provider's data.
- Empty request-parameter text is skipped.
- Do not add a fixed universal `thinking` field.
- Default LLM timeout is 600 seconds unless the existing runtime contract requires a narrower safe limit.
- Do not install, deploy, or issue real paid requests.

## Review Focus

- Switching Provider must not show or send the previous Provider's parameters.
- Switching Agent preset must restore that preset's Provider-specific parameters.
- Empty parameters must leave the request body unchanged.
- Parameter keys must not accidentally replace `messages`, `model`, streaming, or tools fields.
- A manually collapsed prompt card must stay collapsed after adding, saving, and rerendering.

### Task 1: Prompt-group drag ordering

**Files:**
- Modify: `modules/draw/providers/novelai/novel-draw.html`
- Modify: `modules/draw/shared/prompt-groups.js`
- Test: `tests/novelai/comic-browser.test.mjs`, `tests/novelai/comic-modes.test.mjs`

- [ ] Write a failing browser test that drags/reorders two rows and asserts saved `promptGroups` order, then verify preset switching restores it.
- [ ] Run the focused browser test and confirm it fails because rows have no reorder operation.
- [ ] Add a row drag handle and reorder only within the active group; preserve title, body, enabled flag, and open state.
- [ ] Run focused browser and prompt-group tests.

### Task 2: Full-width folded image row

**Files:**
- Modify: `modules/draw/shared/draw-common.js`
- Modify: `style.css`
- Test: `tests/novelai/comic-browser.test.mjs`

- [ ] Add a failing DOM assertion that the image card and fold summary use the available row width.
- [ ] Replace the `fit-content` outer width rule with a full-width scoped rule while keeping the image's intrinsic aspect ratio.
- [ ] Verify existing slot actions and fold state preservation.

### Task 3: Provider-specific request body parameters

**Files:**
- Modify: `modules/agent-core/config.js`
- Modify: `modules/agent-core/ui/settings-panel.js` and `modules/agent-core/ui/settings-markup.js`
- Modify: `modules/agent-core/provider-resolution.js`
- Modify: Agent adapter request construction in `modules/agent-core/dist/agent-core-browser.js` source/build path used by the project
- Modify: `modules/draw/shared/comic-agent.js` and `modules/draw/shared/draw-agent-runtime.js` only where the existing adapter input is assembled
- Test: `tests/novelai/comic-modes.test.mjs` plus Agent/config tests already covering provider resolution

- [ ] Write a failing config test for one visible current-Provider control, per-Provider persistence, empty skip, and request-body merge.
- [ ] Run it and confirm the new field is currently dropped.
- [ ] Add one text control bound to the selected Provider's stored request-body parameter text; preserve it across preset and Provider changes.
- [ ] Normalize empty text to no parameters. Parse the agreed request-body representation at the adapter boundary and keep protected transport fields from accidental overwrite.
- [ ] Pass the resulting object through `adapter.chat()` and each supported provider payload builder.
- [ ] Test OpenAI-compatible and SillyTavern-hosted paths separately where their request assembly differs.

### Task 4: Configurable LLM timeout

**Files:**
- Modify: `modules/agent-core/config.js`, `modules/agent-core/provider-resolution.js`, settings UI files
- Modify: `modules/draw/shared/comic-agent.js`, `modules/draw/shared/draw-agent-runtime.js`, and callers for modes ①②③ and AI rewrite
- Test: focused Agent and browser tests

- [ ] Write failing tests for default 600 seconds, saved custom timeout, empty/default behavior, and abort at configured timeout.
- [ ] Add the visible timeout control and store it with the active Agent preset.
- [ ] Propagate the normalized timeout to every LLM request path and keep image-generation/network timeouts unchanged.
- [ ] Verify timeout errors appear in the existing logs with the configured value.

### Task 5: Documentation and verification

**Files:**
- Modify: `docs/2026-10-11-三种LLM生图模式需求.md`
- Modify: version manifests/packages after implementation

- [ ] Update section 24 with the final parameter representation, protected-field behavior, timeout range/default, and exact version.
- [ ] Run focused tests, module-closure, smoke checks, syntax checks, and `git diff --check`.
- [ ] Record source-only verification boundaries; do not claim live酒馆 acceptance.
