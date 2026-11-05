#!/usr/bin/env python3
"""장 구성 요약 (B1 제안 6): 부대별 상태·수·선두와 거리, 조건. 사용: tools/stage_summary.py 9 42 43"""
import json, sys
d = json.load(open('public/assets/data/battles.json'))
for n in sys.argv[1:]:
    for k in [x for x in d['records'] if x.split('-')[0] == n]:
        r = d['records'][k]
        lead = r['slots'][0] if r['slots'] else [0, 0]
        far = lambda u: abs(u['at'][0] - lead[0]) + abs(u['at'][1] - lead[1])
        gs = ' '.join(f"t{i + 2}:s{g['active']}x{len(g['units'])}(d{min(far(u) for u in g['units'])})" for i, g in enumerate(r['groups']))
        print(f"{k}: 칸{len(r['slots'])} 선두{lead} NPC{len(r['npc'])}s{r['npcState']} | {gs}")
    c = d['cond'].get(n)
    print('  조건', json.dumps(c, ensure_ascii=False)[:200])
    s = (d.get('start') or {}).get(n)
    if s: print('  시작', json.dumps(s, ensure_ascii=False)[:160])
    e = (d.get('turn') or {}).get(n)
    if e: print('  턴', json.dumps(e, ensure_ascii=False)[:220])
