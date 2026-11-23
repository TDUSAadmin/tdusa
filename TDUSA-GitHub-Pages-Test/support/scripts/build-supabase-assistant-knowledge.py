#!/usr/bin/env python3
"""Regenerate the embedded reviewed knowledge for a Supabase Edge Function.
Run from the support folder. Review all facts before deployment.
"""
import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
knowledge=root/'knowledge'
function=root/'backend'/'tdusa-assistant.js'
source=function.read_text(encoding='utf-8')
start=source.index('const verifiedKnowledge=')
end=source.index('\nasync function body',start)
items=[]
for path in sorted(knowledge.glob('*.json')):
    record=json.loads(path.read_text(encoding='utf-8'))
    item={'title':record['title'],'facts':record.get('facts',[]) if record.get('status')=='reviewed_public_site' else []}
    for key in ('website_2026_listing','links'):
        if key in record:
            item[key]=record[key]
    items.append(item)
if not items:
    raise SystemExit('No knowledge files found; function not changed.')
function.write_text(source[:start]+'const verifiedKnowledge='+json.dumps(items,ensure_ascii=False,separators=(',',':'))+';'+source[end:],encoding='utf-8')
print(f'Updated embedded reference data from {len(items)} files; redeploy the Supabase function after review.')
