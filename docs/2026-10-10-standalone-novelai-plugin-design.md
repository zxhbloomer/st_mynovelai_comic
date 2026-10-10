# Standalone NovelAI Plugin for SillyTavern

## Goal

Extract all NovelAI-specific behavior currently present in
`D:/game/tools/github/LittleWhiteBox-main` and deliver it as an independently
installable SillyTavern extension plus server plugin. The delivered project
must run without LittleWhiteBox source files, packages, runtime globals, or
network calls to LittleWhiteBox.

## Scope

The migration covers the current NovelAI implementation, including:

- configuration UI, persistence, migration, connection probing, and API-key handling;
- prompt guides, prompt presets, import/export, prompt compilation, character prompts,
  negative prompts, coordinates, seeds, and model capability selection;
- legacy NovelAI image generation and V4/V4.5 request construction;
- NovelAI V5 request construction and MessagePack stream decoding;
- foreground generation, serialized request handling, cancellation, retry, timeout,
  cooldown, and error classification;
- optional SillyTavern server-plugin proxy and asynchronous image jobs;
- floor controls, floating controls, progress states, image insertion, saved-image
  handling, preview cache, gallery, and deletion/selection behavior;
- character-tag learning and the NovelAI-specific learning modes that can be
  implemented from SillyTavern character data;
- regression fixtures and tests for the protocol and host adapters.

LittleWhiteBox scene-planner, Agent Core, other image providers, unrelated
databases, and LittleWhiteBox-only event buses are not runtime dependencies.
Where current NovelAI behavior calls those systems, the new plugin exposes a
small local interface or uses SillyTavern data directly.

## Deliverables

### Browser extension

`public/scripts/extensions/novelai/` contains the manifest, lifecycle entry,
settings surface, floating/floor controls, HTML/CSS, pure protocol modules,
storage adapters, and tests. It registers through SillyTavern's extension
loader and uses only documented host modules or browser APIs.

### Server plugin

`plugins/sillytavern-novelai/` contains an npm package/manifest and entry
module compatible with `src/plugin-loader.js`. It registers routes under
`/api/plugins/sillytavern-novelai`, validates request envelopes, proxies
NovelAI legacy requests, executes V5 MessagePack streams, exposes capability
and health status, and owns optional in-memory asynchronous jobs. It must not
import from LittleWhiteBox.

### Pure core

Protocol and compiler modules have no DOM, SillyTavern globals, or Express
imports. They accept explicit configuration and return deterministic request
objects, decoded images, normalized errors, and state transitions.

## Runtime boundaries

The browser extension may use direct NovelAI transport when configured and
may use the server plugin for CORS/TLS/V5 stream handling. The extension must
detect plugin absence and show an actionable state; it must not silently fall
back to LittleWhiteBox endpoints. API keys are never logged or persisted in
test fixtures. Server jobs are process-local and are cleared on restart unless
SillyTavern later provides a persistent job store.

The host adapter is responsible for SillyTavern settings, request headers and
CSRF behavior, character/worldbook reads, message/floor insertion, image
storage, extension lifecycle, and localization hooks. Core modules receive
these operations through explicit functions.

## API shape

The server plugin provides versioned routes for health/capabilities, a legacy
generate request, a V5 stream request, connection test, and asynchronous job
create/status/result/cancel. Every request includes a provider discriminator,
validated transport, timeout, and opaque request payload. Results are either
PNG bytes/base64 with MIME metadata or a structured error containing a stable
category and provider message.

The browser client uses one transport interface for direct and proxied modes.
The compiler selects legacy-image or msgpack-stream from an explicit model
capability table; it never infers capability from a URL. V5 stream parsing
must yield the final PNG only after a valid terminal event and must expose
progress without leaking raw MessagePack into UI state.

## Migration rules

Each LittleWhiteBox module is classified as pure core, host adapter, UI, or
server transport before copying. Imports are rewritten rather than shimmed.
Configuration versions are migrated explicitly and invalid values are
normalized with visible warnings. Existing LittleWhiteBox setting names may
be accepted by an import tool, but normal runtime storage uses a namespaced
SillyTavern key owned by this plugin.

## Verification and acceptance

Automated checks must cover deterministic compiler fixtures for legacy/V4/V4.5/V5,
MessagePack stream fixtures, response/error decoding, configuration migration,
job lifecycle and cancellation, and server route validation. Browser checks
must cover extension discovery, settings save/reload, direct/proxy mode,
floating and floor controls, generated image insertion, and cache/gallery
operations with mocked transport.

Real-host acceptance is separate: install only the delivered plugin into a
clean SillyTavern checkout, confirm no LittleWhiteBox path is present in the
runtime dependency graph, test NovelAI connection and at least one legacy and
one V5 generation with user credentials, then test restart behavior and
plugin-disabled behavior. Automated tests cannot mark this acceptance done.

## Risks and limits

NovelAI's V5 stream protocol is not fully represented by the public Swagger;
the implementation must rely on the inspected LittleWhiteBox parser and
captured fixtures, with protocol changes surfaced as explicit failures.
SillyTavern host internals can change, so all host access stays behind a small
adapter and is tested against the target checkout. No unrelated LittleWhiteBox
features are migrated under the NovelAI label.

