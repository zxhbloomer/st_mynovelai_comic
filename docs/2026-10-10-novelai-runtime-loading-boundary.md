# NovelAI runtime loading boundary

## Loaded by the independent extension

- `index.js` → `runtime.js`
- `runtime.js` → `core/*`, `host.js`, `floating.js`, `floor-buttons.js`, `gallery.js`, `storage/preview-cache.js`, `generation-state.js`
- server runtime → `server-plugin/sillytavern-novelai/index.js` and its NovelAI transport/job modules

These modules must remain free of LittleWhiteBox imports, paths, route IDs, and
communication markers.

## Reference mirror files

`novel-draw.js`, `floating-panel.js`, and copied provider UI modules are retained
for behavior comparison while their remaining host dependencies are migrated.
They are not imported by `index.js` or `runtime.js` and are not runtime
acceptance evidence. Their original structure may be preserved to make future
source comparison straightforward.

## Acceptance rule

A runtime change is accepted only when the loaded dependency graph passes the
independent import/route/smoke checks. Reference mirror files are tracked in
the inventory separately and do not block those checks until they become part
of the loaded graph.
