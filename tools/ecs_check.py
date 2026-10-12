"""개선판 대본(content/remake/chapters/*.ecs, epilogue.ecs, banter.ecs) 점검: 화자 이름, 원작 줄 번호(=N)가 그 장의 원작 장면에 있는지, 원작 줄 중 빠진 것.
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
EPI = os.path.join(R, 'content', 'remake', 'epilogue.ecs')
for path in sorted(glob.glob(os.path.join(R, 'content', 'remake', 'chapters', '*.ecs'))) + [EPI]:
    n = int(re.search(r'(\d+)\.ecs$', path)[1]) if path != EPI else 0   # 에필로그 = 0장 (원작 줄 없음)
    own, used, new = chapter_lines(n) if n else {}, set(), 0
    for i, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = re.sub(r'\s+#.*$|^#.*$', '', raw).strip()
        if line.startswith('=='):   # 블록 머리: dead·hp 의 인물, 조건의 in/party 인물
            w = line[2:].split()
            names = [w[1]] if w and w[0] in ('dead', 'hp') and len(w) > 1 else []
            names += [x.split('=', 1)[1] for x in w if re.match(r'^!?(in|party)=', x)]
            for nm in names:
                if not who_ok(nm): print(f'{n:02}.ecs:{i}: 모르는 인물 {nm}'); bad += 1
            continue
        if not line or line.startswith(('card ', 'goal ', '? ', '> ', 'do ')) or line == 'keep': continue
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
# 동료 한마디: @ 인물 이름, 시점 이름
for i, raw in enumerate(open(os.path.join(R, 'content', 'remake', 'banter.ecs'), encoding='utf-8'), 1):
    line = re.sub(r'\s+#.*$|^#.*$', '', raw).strip()
    if not line: continue
    if line.startswith('@'):
        if not who_ok(line[1:].strip()): print(f'banter.ecs:{i}: 모르는 인물 {line[1:].strip()}'); bad += 1
    elif not re.match(r'^(start|boss|win):\s*\S', line): print(f'banter.ecs:{i}: 형식'); bad += 1
print('문제', bad)
