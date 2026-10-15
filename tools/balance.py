"""전투 밸런스 요약 (balance-proposal.md 근거). public/assets/data 의 units/items/battles.json 만 읽는다.
사용: python tools/balance.py [curve [루트 0~2]|joiners] [--f orig|floor|ratio]
  curve    루트 순서대로 장마다 적 수·평균/최대 레벨·평균 HP·평균 k1/k2
  joiners  합류 동료 (합류 레벨 그대로) 대 그 장 적: 주는 피해·처치 타수, 받는 피해·버티는 타수
  --f      피해식. orig = 원작 (k1 − k2)/100 [1,99] / floor = max(원작, 0.15·k1/100) / ratio = 0.4·k1²/(k1+k2)/100
대략값: 지형 100%·피로 0·장비는 PAD 기본 (승급 없음), 성장은 넣지 않는다 (합류 레벨 그대로 비교)."""
import json, math, os, sys

D = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'data')
load = lambda n: json.load(open(os.path.join(D, n + '.json'), encoding='utf-8'))
U = {u['id']: u for u in load('units')}
I = {i['id']: i for i in load('items')}
B = load('battles')
FIELD = [None, 'hp', 'spi', 'atk', 'def', None, 'mov', 'agi', None]   # EAD 능력치 번호 (unit.ts equippedStats)


def stats(t):
    s = {k: t[k] for k in ('hp', 'atk', 'def', 'spi', 'agi', 'mov')}
    for e in t['equip']:
        it = I.get(e)
        for n, v in ((it['stat'], it['stat2']) if it else ()):
            f = FIELD[n - 8 if n > 8 else n]
            if f: s[f] += -v if n > 8 else v
    return s


F0 = (1.5 - 1.01) * (1.6 - 1.01)   # 피로 0
k1 = lambda s: int((0.7 * s['atk'] + 0.3 * s['agi']) * (2.6 - F0) * 100)
k2 = lambda s: int((0.7 * s['def'] + 0.3 * s['agi']) * (2.4 - F0) * 100)
FORMULA = {
    'orig': lambda a, d: (a - d) / 100,
    'floor': lambda a, d: max((a - d) / 100, 0.15 * a / 100),
    'ratio': lambda a, d: 0.4 * a * a / (a + d) / 100,
}
form = sys.argv[sys.argv.index('--f') + 1] if '--f' in sys.argv else 'orig'
dmg = lambda a, d: max(1, min(99, int(FORMULA[form](k1(a), k2(d)))))


def enemies(stage, route=0):
    r = B['records'].get(f'{stage}-{route}') or B['records'].get(f'{stage}-0')
    return [U[x['type']] for g in r['groups'] for x in g['units']] if r else []


def curve(route):
    print('순번 장  적수 평균lv 최대lv 평균HP  k1평균 k2평균')
    seen = set()
    for step, row in enumerate(B['route']):
        stg = row[route]
        es = enemies(stg, route)
        if not es or stg in seen: continue
        seen.add(stg)
        S = [stats(t) for t in es]
        lv = [t['lv'] for t in es]
        print(f'{step:3} {stg:4} {len(es):3} {sum(lv)/len(lv):6.1f} {max(lv):5} {sum(s["hp"] for s in S)/len(S):6.1f}'
              f' {sum(map(k1, S))/len(S):7.0f} {sum(map(k2, S))/len(S):6.0f}')


# (유닛 종류, 합류하는 장) — story.md 장별 흐름. 레스다는 1장 초기 일행, 아리크스 2차는 37장
JOINERS = [(0, 1), (14, 1), (18, 1), (8, 2), (3, 7), (17, 7), (16, 9), (2, 11), (12, 16), (5, 17), (25, 18),
           (4, 20), (24, 27), (6, 29), (23, 36), (1, 37), (26, 37), (28, 38), (1, 43)]


def joiners():
    print(f'피해식 {form}. 주는 피해 평균 (처치 타수 평균/최소) | 받는 피해 중간/최대 (버티는 타수 최소~중간)')
    for uid, stg in JOINERS:
        a, S = stats(U[uid]), [stats(t) for t in enemies(stg)]
        out = [dmg(a, s) for s in S]
        inn = sorted(dmg(s, a) for s in S)
        htk = [math.ceil(s['hp'] / d) for s, d in zip(S, out)]
        surv = sorted(math.ceil(a['hp'] / d) for d in inn)
        print(f'{U[uid]["name"]:5} lv{U[uid]["lv"]:2} {stg:2}장: 줌 {sum(out)/len(out):5.1f} ({sum(htk)/len(htk):5.1f}/{min(htk):3})'
              f' | 받음 {inn[len(inn)//2]:3}/{inn[-1]:3} ({surv[0]}~{surv[len(surv)//2]})')


args = [x for x in sys.argv[1:] if x != '--f' and x not in FORMULA]
cmd = args[0] if args else 'curve'
curve(int(args[1]) if len(args) > 1 else 0) if cmd == 'curve' else joiners()
