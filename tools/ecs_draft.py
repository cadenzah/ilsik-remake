"""개선판 대본(.ecs) 초안: 원작 장면을 .ecs 블록 꼴로 출력 (원작 줄 번호 =N ~ 원문). 결과는 저장소 밖(스크래치)에 두고 고쳐 쓴다.
사용: python tools/ecs_draft.py 장… — 동료 화자에는 (동료) 표시 = 출전하지 않을 수 있어 화자 대체(제안 11) 검토 대상"""
import json, os, sys

D = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'data')
load = lambda n: json.load(open(os.path.join(D, n + '.json'), encoding='utf-8'))
SC, DLG, UNITS, BT = load('scenes'), load('dialogue'), load('units'), load('battles')
NAME = {u['id']: u['name'] for u in UNITS}
ROUTES = [list(dict.fromkeys(r[k] for r in BT['route'][1:])) for k in range(3)]
PARTYMEMBER = set(range(2, 29)) - {0, 1}


def member_name(n, t, m):
    for r in range(3):
        rec = BT['records'].get(f'{n}-{r}')
        if rec and t >= 1 and t - 1 < len(rec['groups']) and m < len(rec['groups'][t - 1]['units']):
            return NAME[rec['groups'][t - 1]['units'][m]['type']]
    return f'{t}.{m}'


def lines(key):
    out = []
    for c, l, br in SC['scenes'].get(key, []):
        w = NAME.get(c, '?') if c >= 0 else '-'
        tag = '  # (동료)' if c in PARTYMEMBER else ''
        out.append(f'{"  [분기%d] " % br if br else ""}{w}: ={l} ~ {DLG[l]}{tag}')
    return out


def draft(n):
    rs = ''.join('ABC'[k] for k in range(3) if n in ROUTES[k])
    slots = {('ABC'[r]): len(BT['records'][f'{n}-{r}']['slots']) for r in range(3) if f'{n}-{r}' in BT['records']}
    print(f'# ===== {n}장 [{rs}] 출전 칸 {slots}')
    keys = SC['pre'].get(str(n), [])
    if keys:
        print(f'== pre   # {keys}')
        for k in keys: print('\n'.join(lines(k)))
    for rule in BT['cond'].get(str(n), []):
        sc = [d['scene'] for d in rule['do'] if isinstance(d, dict) and 'scene' in d]
        if not sc: continue
        c = rule['if']
        when = f"dead {member_name(n, *c['dead'][0])}" if 'dead' in c else f"onlyLeft {member_name(n, *c['onlyLeft'])}"
        print(f'== {when}   # 전투 중 {sc} do={[d for d in rule["do"] if not (isinstance(d, dict) and "scene" in d)]}')
        for k in sc: print('\n'.join(lines(k)))
    for e in BT['turn'].get(str(n), []):
        for d in e.get('do', []):
            if isinstance(d, dict) and 'scene' in d:
                print(f"== turn {e['turn']}{' flag=' + e['flag'] if 'flag' in e else ''}   # {d['scene']}")
                print('\n'.join(lines(d['scene'])))
    for e in SC['post'].get(str(n), []):
        cond = (' route=' + '|'.join('ABC'[r] for r in e['routes']) if 'routes' in e else '') + \
            (f" flag={e['flag']}" if 'flag' in e else '') + (f" item={e['item']}" if 'item' in e else '') + \
            (f" !item={e['noItem']}" if 'noItem' in e else '')
        if 'scene' in e:
            print(f"== post{cond}   # {e['scene']}")
            print('\n'.join(lines(e['scene'])))
        else:
            print(f'# 후 단계{cond}: {json.dumps({k: v for k, v in e.items() if k != "routes"}, ensure_ascii=False)}'
                  + (f" ({NAME[e['join']]})" if 'join' in e else ''))
    print()


if __name__ == '__main__':
    for a in sys.argv[1:]: draft(int(a))
