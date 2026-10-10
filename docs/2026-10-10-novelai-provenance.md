# NovelAI Provenance and Copy Boundary

## Source

Primary source inspected: `D:/game/tools/github/LittleWhiteBox-main`.
Observed provider source, server transport, fixtures, tests, guides, and
vendor notices are listed in `2026-10-10-novelai-inventory.md`.

## Boundary

Pure request algorithms and behavior may be reimplemented from observed
inputs/outputs. Host wiring, UI structure, server routes, and storage are
rewritten for SillyTavern. Third-party MessagePack/vendor code is not copied
until its license notice and redistribution terms are recorded. LittleWhiteBox
branding, unrelated provider code, Agent Core, and private data are excluded.

## Verification receipt

The inventory was produced from filesystem enumeration and export/import
searches on 2026-10-10. It is a source inspection receipt, not proof that the
new extension loads in a real SillyTavern host. Real-host acceptance remains
Task 8.
