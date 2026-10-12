"""개선판 대본(content/remake/chapters/*.ecs) 점검: 화자 이름, 원작 줄 번호(=N)가 그 장의 원작 장면에 있는지, 원작 줄 중 빠진 것.
엔진 문법 검사는 src/core/script.ts (게임이 불러올 때). 사용: python tools/ecs_check.py"""
import glob, json, os, re

R = os.path.join(os.path.dirname(__file__), '..')
D = os.path.join(R, 'public', 'assets', 'data')
load = lambda n: json.load(open(os.path.join(D, n + '.json'), encoding='utf-8'))
SC, BT, UNITS = load('scenes'), load('battles'), load('units')
ALIAS = json.load(open(os.path.join(R, 'content', 'remake', 'names.json'), encoding='utf-8'))
NAMES = {u['name']: u['id'] for u in UNITS}
IDS = {u['id']: u['name'] for u in UNITS}


def chapter_lines(n):
    keys = list(SC['pre'].get(str(n), []))
    keys += [d['scene'] for r in BT['cond'].get(str(n), []) for d in r['do'] if isinstance(d, dict) and 'scene' in d]
    keys += [d['scene'] for e in BT['turn'].get(str(n), []) for d in e.get('do', []) if isinstance(d, dict) and 'scene' in d]
    keys += [e['scene'] for e in SC['post'].get(str(n), []) if 'scene' in e]
    return {l: br for k in keys for _, l, br in SC['scenes'].get(k, [])}


def who_ok(w):
    w = w.strip()
    if w in ('-', '출전'): return True
    m = re.match(r'^(.+)#(\d+)$', w)
    if m: return IDS.get(int(m[2])) == ALIAS.get(m[1], m[1])
    return ALIAS.get(w, w) in NAMES


bad = 0
for path in sorted(glob.glob(os.path.join(R, 'content', 'remake', 'chapters', '*.ecs'))):
    n = int(re.search(r'(\d+)\.ecs$', path)[1])
    own, used, new = chapter_lines(n), set(), 0
    for i, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = re.sub(r'\s+#.*$|^#.*$', '', raw).strip()
        if not line or line.startswith(('card ', 'goal ', '==', '? ', '> ', 'do ')) or line == 'keep': continue
        m = re.match(r'^([^:]+):\s*(.*)$', line)
        if not m: print(f'{n:02}.ecs:{i}: 형식'); bad += 1; continue
        for w in m[1].rstrip('?').split('|'):
            if not who_ok(w): print(f'{n:02}.ecs:{i}: 모르는 인물 {w}'); bad += 1
        r = re.match(r'^=(\d+)', m[2])
        if r:
            ref = int(r[1]); used.add(ref)
            if ref not in own: print(f'{n:02}.ecs:{i}: ={ref} 은 이 장의 원작 줄이 아님'); bad += 1
        else: new += 1
    miss = sorted(l for l, br in own.items() if l not in used and br != 2)
    print(f'{n:02}장: 원작 {len(own)}줄 중 {len(used)} 사용, 새 줄 {new}' + (f', 안 쓴 원작 줄 {miss}' if miss else ''))
print('문제', bad)
