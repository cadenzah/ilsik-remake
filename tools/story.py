"""스토리 분석용 요약. public/assets/data 의 scenes/dialogue/units/battles.json 만 읽는다 (EXE 불필요).
사용: python tools/story.py [script [장…]|stats|routes]
  script  장별 대본 (전/중/후 장면, 합류, 화자: 대사)  — 장 번호를 주면 그 장만
  stats   인물별 대사 줄 수·등장 장 수, 장별 대사량, 루트별 인물 대사 줄 수 (루트 조건 반영, 분기2·소지품 조건 제외)
  routes  루트 3개의 장 순서와 루트 전용 장"""
import json, os, sys
from collections import Counter, defaultdict

D = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'data')
load = lambda n: json.load(open(os.path.join(D, n + '.json'), encoding='utf-8'))
SC, DLG, UNITS, BT = load('scenes'), load('dialogue'), load('units'), load('battles')
NAME = {u['id']: u['name'] for u in UNITS}
# 전투 순서표: 0행은 빈 칸, 값 = 장 번호. 루트 C 는 28전에 43장 도달 (29행은 중복)
ROUTES = [list(dict.fromkeys(r[k] for r in BT['route'][1:])) for k in range(3)]


def who(c):
    return NAME.get(c, f'#{c}') if c >= 0 else '(지문)'


def stage_scenes(s):
    """[(시점, 장면키 또는 사건)] — 전투 전, 전투 중 트리거, 전투 후 순."""
    out = [('전', k) for k in SC['pre'].get(str(s), [])]
    out += [('중', k) for k in SC['trigger'] if scene_stage(k) == s]
    for e in SC['post'].get(str(s), []):
        when = '후' + (''.join('ABC'[r] for r in e['routes']) if 'routes' in e else '') + \
            (f" {e['flag']}" if 'flag' in e else '') + (f" 도구{e['item']}" if 'item' in e else '') + \
            (f" 도구{e['noItem']}없음" if 'noItem' in e else '')
        out.append((when, e['scene'] if 'scene' in e else {k: v for k, v in e.items() if k in ('join', 'count', 'set')}))
    return out


def scene_stage(key):
    """장면 번호 = 장 또는 장*10+k."""
    n = int(key.split(':')[1])
    return n if n <= 43 else n // 10


def lines(key):
    return SC['scenes'].get(key, [])


def script(only=None):
    for s in range(1, 44):
        if only and s not in only: continue
        rs = ''.join('ABC'[k] for k in range(3) if s in ROUTES[k])
        print(f'\n=== {s}장 [{rs or "-"}]')
        for when, k in stage_scenes(s):
            if not isinstance(k, str):
                print(f'  ({when}) {k}'); continue
            print(f'  ({when} {k})')
            for c, l, br in lines(k):
                tag = f' [분기{br}]' if br else ''
                print(f'    {who(c)}{tag}: {DLG[l]}')


def stats():
    cnt, chars, stages = Counter(), Counter(), defaultdict(set)
    per_stage = Counter()
    for s in range(1, 44):
        for _, k in stage_scenes(s):
            if not isinstance(k, str): continue
            for c, l, _ in lines(k):
                cnt[c] += 1; chars[c] += len(DLG[l]); stages[c].add(s); per_stage[s] += 1
    print('인물  줄수  글자수  등장장수  첫장~끝장')
    for c, n in cnt.most_common():
        st = sorted(stages[c])
        print(f'{who(c)}({c})  {n}  {chars[c]}  {len(st)}  {st[0]}~{st[-1]}')
    print('\n장별 줄수:', ' '.join(f'{s}:{per_stage[s]}' for s in range(1, 44)))
    joins = [(s, e['join']) for s in range(1, 44) for e in SC['post'].get(str(s), []) if 'join' in e]
    print('합류:', ' '.join(f'{s}장→{who(j)}({j})' for s, j in joins))


def route_stats():
    """루트마다 실제로 보게 되는 대사 (post 의 routes 반영, flag 는 켬, item 은 요정피리 없음 기준, 분기 '예')."""
    tot = {}
    for k, rt in enumerate(ROUTES):
        c = Counter()
        for s in rt:
            keys = SC['pre'].get(str(s), []) + [t for t in SC['trigger'] if scene_stage(t) == s]
            keys += [e['scene'] for e in SC['post'].get(str(s), []) if 'scene' in e and
                     ('routes' not in e or k in e['routes']) and 'item' not in e]
            for key in keys:
                for who_, l, br in lines(key):
                    if br != 2: c[who_] += 1
        tot[k] = c
    names = sorted({w for c in tot.values() for w in c}, key=lambda w: -sum(tot[k][w] for k in tot))
    print('인물  A  B  C')
    for w in names: print(f'{who(w)}({w})', *(tot[k][w] for k in range(3)))
    print('합계', *(sum(tot[k].values()) for k in range(3)))


def routes():
    for k, r in enumerate(ROUTES):
        only = [s for s in r if not any(s in ROUTES[j] for j in range(3) if j != k)]
        print(f'루트{"ABC"[k]}: {r}\n  전용: {only}')
    print('공통:', [s for s in ROUTES[0] if all(s in r for r in ROUTES)])


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'stats'
    if cmd == 'script': script({int(a) for a in sys.argv[2:]} or None)
    elif cmd == 'routes': routes(); route_stats()
    else: stats()
