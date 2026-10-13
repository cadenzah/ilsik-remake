"""맵 지형을 글자로 (배치 설계용). . 평지  ^ 숲·바위(비용 2)  # 절벽(통행 불가). 원작 배치: P 출전 칸, N NPC, 1~9 적 무리(부대 번호 아님, 무리 순번)
사용: python tools/map_ascii.py 맵번호 [기록키 예: 36-0] [extra.json — 개선판 숨은 장 배치를 겹쳐 보기]"""
import json, os, sys
R = os.path.join(os.path.dirname(__file__), '..')
n = int(sys.argv[1])
m = json.load(open(os.path.join(R, 'public', 'assets', 'stages', f'{n:02}.json')))
B = json.load(open(os.path.join(R, 'public', 'assets', 'data', 'battles.json')))
grid = [['.^^##'[min(m['layer2'][y * m['w'] + x], 4)] for x in range(m['w'])] for y in range(m['h'])]
rec = None
if len(sys.argv) > 3: rec = json.load(open(sys.argv[3]))['record']
elif len(sys.argv) > 2: rec = B['records'][sys.argv[2]]
if rec:
    for x, y in rec['slots']: grid[y][x] = 'P'
    for u in rec.get('npc', []): grid[u['at'][1]][u['at'][0]] = 'N'
    for k, g in enumerate(rec['groups']):
        for u in g['units']: grid[u['at'][1]][u['at'][0]] = str(k + 1)
print('   ' + ''.join(str(x % 10) for x in range(m['w'])))
for y, row in enumerate(grid): print(f'{y:2} ' + ''.join(row))
