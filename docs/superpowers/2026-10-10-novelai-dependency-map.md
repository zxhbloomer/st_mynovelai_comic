# NovelAI source dependency map

This map is based on the actual LittleWhiteBox tree, not on inferred behavior.

| Source area | Destination | Status |
|---|---|---|
| `compiler.js`, request/config/capability modules | `modules/novelai/core/` and browser `core/` | copied/adapted and smoke-tested |
| `novel-draw.js`, `novel-draw.html` | `public/scripts/extensions/novelai/` | copied, but source host imports remain to be replaced |
| `floating-panel.js` | `public/scripts/extensions/novelai/` | copied, but source shared imports remain to be replaced |
| `cloud-presets.js` | `public/scripts/extensions/novelai/` | copied; UI integration pending |
| `novel-v5-stream.js`, image response, backend result | browser/server core | copied; independent transport partly integrated |
| source NovelAI tests and fixtures | `tests/novelai/` | only selected smoke coverage copied so far |
| LittleWhiteBox host/shared imports | `host-adapter.js` (planned) | unresolved; current primary completion blocker |

The source file list is recorded in `docs/superpowers/source-novelai-files.txt`. Any item marked unresolved must be closed before claiming complete migration.
