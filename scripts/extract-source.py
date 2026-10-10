"""Copy the NovelAI browser dependency closure, preserving source-relative paths."""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
source = args.source.resolve()
target = Path(__file__).resolve().parents[1]
pattern = re.compile(r'''(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"\n]+)['"]''')
pending = list((source / 'modules/draw/providers/novelai').glob('*.*'))
seen = set()
external = {}
missing = []
while pending:
    file = pending.pop().resolve()
    if file in seen:
        continue
    if not file.is_relative_to(source):
        continue
    seen.add(file)
    if not file.exists():
        missing.append(str(file.relative_to(source)))
        continue
    if file.suffix not in ('.js', '.mjs', '.html'):
        continue
    text = file.read_text(encoding='utf-8-sig')
    for spec in pattern.findall(text):
        if not spec.startswith('.'):
            continue
        resolved = (file.parent / spec).resolve()
        if resolved.is_relative_to(source):
            pending.append(resolved)
        else:
            external.setdefault(str(file.relative_to(source)), []).append(spec)

# Resources fetched by source code rather than ES module imports.
for directory in ['modules/draw/shared/prompts', 'modules/draw/shared/data', 'modules/draw/providers/novelai/tests']:
    seen.update(p for p in (source / directory).rglob('*') if p.is_file())
seen.update((source / 'libs').glob('*.mjs'))
report = {'files': sorted(str(p.relative_to(source)).replace('\\', '/') for p in seen), 'hostImports': external, 'missing': missing}
print(json.dumps(report, ensure_ascii=False, indent=2))
if args.write:
    for file in seen:
        if not file.is_file():
            continue
        dest = target / file.relative_to(source)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(file.read_bytes())
    (target / 'docs/superpowers/source-browser-closure.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
