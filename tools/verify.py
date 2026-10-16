"""43장 (+ 개선판 숨은 장 44·45) 정적 통과 점검. 루트마다 원작 순서대로 일행을 굴려 가며 장마다 본다:
배치 칸 (맵 안·통행·겹침), 조건·턴 이벤트가 가리키는 대원·부대, 도달 칸 연결, 적을 칠 수 있는 칸, 숨은 부대가 깨어나는지,
장면 키·대사 번호, 장 순서와 엔딩, 대본 파일. 통행 = src/core/grid.ts moveCost, 일행 처리 = src/core/campaign.ts applyStep.
개선판 대본이 장 단계를 대신 쓰는 장 (ownSteps) 은 원작 단계로 근사한다. 사용: python tools/verify.py [-v] [--plan]  (--plan = build/verify_plan.json, 브라우저 자동 진행 검증의 장별 시작 상태)"""
import glob, json, os, sys

R = os.path.join(os.path.dirname(__file__), '..')
D = os.path.join(R, 'public', 'assets', 'data')
load = lambda n: json.load(open(os.path.join(D, n + '.json'), encoding='utf-8'))
BT, SC, UNITS, DIA = load('battles'), load('scenes'), load('units'), load('dialogue')
T = {u['id']: u for u in UNITS}
VERBOSE = '-v' in sys.argv
EXTRA = {int(os.path.basename(p)[:2]): json.load(open(p, encoding='utf-8'))
         for p in glob.glob(os.path.join(R, 'content', 'remake', 'battles', '*.json'))}
ECS = {os.path.basename(p)[:2] for p in glob.glob(os.path.join(R, 'content', 'remake', 'chapters', '*.ecs'))}
DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))
errs, warns, stuck = [], [], {}
PLAN = []   # --plan: 브라우저 자동 검증용 장별 시작 상태 (장 번호·루트·일행·소지품·플래그)
_maps = {}


def stage(n):
    if n not in _maps:
        _maps[n] = json.load(open(os.path.join(R, 'public', 'assets', 'stages', f'{n:02d}.json')))
    return _maps[n]


def passable(m, x, y, kind):
    if not (0 <= x < m['w'] and 0 <= y < m['h']): return False
    v = m['layer2'][y * m['w'] + x]
    return v == 3 if kind == 3 else v <= kind


def flood(m, start, kind):
    """유닛을 무시한 통행 가능 칸 (이동력 무한)"""
    seen, todo = {tuple(start)}, [tuple(start)]
    while todo:
        x, y = todo.pop()
        for dx, dy in DIRS:
            c = (x + dx, y + dy)
            if c not in seen and passable(m, *c, kind):
                seen.add(c); todo.append(c)
    return seen


def scene_ok(where, key):
    if key not in SC['scenes']:
        errs.append(f'{where}: 장면 {key} 없음'); return
    for who, line, _ in SC['scenes'][key]:
        if not 0 <= line < len(DIA): errs.append(f'{where}: 장면 {key} 대사 번호 {line} 범위 밖')
        if who >= 0 and who not in T: errs.append(f'{where}: 장면 {key} 화자 {who} 없음')


def check(n, route, party, items, flags, rec, cond, turn, label, start=()):
    w = f'{label} (루트 {route})'
    m = stage(n)
    k = min(8, len(rec['slots']), len(party))
    if not party: errs.append(f'{w}: 일행 없음')
    if len(rec['slots']) < 1: errs.append(f'{w}: 출전 칸 없음')
    troops = [[(party[i], rec['slots'][i]) for i in range(k)]]
    states = [0]
    if rec['npc']:
        troops.append([(u['type'], u['at']) for u in rec['npc']]); states.append(rec['npcState'])
    for g in rec['groups']:
        troops.append([(u['type'], u['at']) for u in g['units']]); states.append(g['active'])
    allies = troops[:2] if rec['npc'] else troops[:1]
    # 배치 칸
    seen = {}
    for t, tr in enumerate(troops):
        for i, (ty, at) in enumerate(tr):
            if ty not in T: errs.append(f'{w}: 대원 [{t},{i}] 종류 {ty} 없음'); continue
            if not passable(m, *at, T[ty]['moveKind']):
                if t > 0: stuck.setdefault(w, []).append(T[ty]['name'])   # 원작 배치 그대로 (제자리에서 싸운다)
                else: errs.append(f'{w}: 일행 [{t},{i}] {T[ty]["name"]} {at} 통행 불가 칸 (이동방식 {T[ty]["moveKind"]})')
            if tuple(at) in seen:
                both_enemy = t >= (2 if rec['npc'] else 1) and int(seen[tuple(at)][1]) >= (2 if rec['npc'] else 1)
                (warns if both_enemy else errs).append(f'{w}: [{t},{i}] {at} 칸 겹침 ({seen[tuple(at)]})' + (' — 원작 데이터, 개선판은 빈 칸으로 옮김' if both_enemy else ''))
            seen[tuple(at)] = f'[{t},{i}]'
    for tr in rec['treasure']:
        if not (0 <= tr['at'][0] < m['w'] and 0 <= tr['at'][1] < m['h']): errs.append(f'{w}: 보물 {tr} 맵 밖')
    exists = lambda mb: 0 <= mb[0] < len(troops) and 0 <= mb[1] < len(troops[mb[0]])
    # 깨우는 이벤트: 턴 이벤트 (루트·플래그 맞는 것), 조건의 state, area
    woken = set()
    gone = set()   # 전투 시작 처리로 자리 비운 일행 칸
    for d in start:
        if 'state' in d:
            for t in d['state'][0]:
                if not 0 <= t < len(troops): errs.append(f'{w}: 시작 처리 부대 {t} 없음')
                elif d['state'][1] != 4: woken.add(t)
        if 'hpScale' in d and not 0 <= d['hpScale'][0] < len(troops): errs.append(f'{w}: 시작 처리 부대 {d["hpScale"][0]} 없음')
        if 'absent' in d: gone |= {i for i, (ty, _) in enumerate(troops[0]) if T[ty]['por'] == d['absent']}
    if 0 in gone: errs.append(f'{w}: 시작 처리가 선두를 지움')
    for e in turn:
        if e.get('route') is not None and e['route'] != route: continue
        if e.get('flag') and e['flag'] not in flags: continue
        if 'area' in e:
            woken.add(e['area'][0])
            if not 0 <= e['area'][0] < len(troops): errs.append(f'{w}: 턴 이벤트 area 부대 {e["area"][0]} 없음')
        for d in e.get('do', []):
            if isinstance(d, dict) and 'state' in d:
                for t in d['state'][0]:
                    if not 0 <= t < len(troops): errs.append(f'{w}: 턴 이벤트 부대 {t} 없음')
                    elif d['state'][1] != 4: woken.add(t)
            if isinstance(d, dict) and 'scene' in d: scene_ok(w, d['scene'])
    win = False
    lead_ty, lead_at = troops[0][0] if troops[0] else (None, None)
    for r in cond:
        c = r['if']
        mbs = c.get('dead', []) + ([c['hpBelow'][0]] if 'hpBelow' in c else []) + ([c['onlyLeft']] if 'onlyLeft' in c else [])
        for mb in mbs:
            if not exists(mb): errs.append(f'{w}: 조건 {c} 의 대원 {mb} 없음 (출전 {k}명)')
        if 'reach' in c and lead_ty is not None:
            if not passable(m, *c['reach'], T[lead_ty]['moveKind']): errs.append(f'{w}: 도달 칸 {c["reach"]} 선두 통행 불가')
            elif tuple(c['reach']) not in flood(m, lead_at, T[lead_ty]['moveKind']): errs.append(f'{w}: 도달 칸 {c["reach"]} 선두 칸에서 이어지지 않음')
        for d in r['do']:
            if d in ('win', 'ending') and 'lose' not in r['do']: win = True
            if isinstance(d, dict):
                if 'scene' in d: scene_ok(w, d['scene'])
                if 'state' in d:
                    for t in d['state'][0]:
                        if not 0 <= t < len(troops): errs.append(f'{w}: 조건 state 부대 {t} 없음')
                        elif d['state'][1] != 4: woken.add(t)
                if 'join' in d and d['join'] not in T: errs.append(f'{w}: 조건 합류 종류 {d["join"]} 없음')
    # 적 처치: 모든 적 HP 0 이 기본 승리 (숨은 부대 대원도 센다)
    first = 2 if rec['npc'] else 1
    reach = {}
    for tr in allies:
        for ty, at in tr:
            reach.setdefault(T[ty]['moveKind'], set()).update(flood(m, at, T[ty]['moveKind']))
    cells = set().union(*reach.values()) if reach else set()
    for t in range(first, len(troops)):
        moves = states[t] != 3 and states[t] != 2 or t in woken
        if states[t] == 4 and t not in woken:
            (warns if win else errs).append(f'{w}: 부대 {t} 숨김(4) 인데 깨우는 이벤트 없음' + (' — 조건 승리가 있어 막히지는 않음' if win else ' → 모든 적 처치 승리 불가'))
        for i, (ty, at) in enumerate(troops[t]):
            own = flood(m, at, T[ty]['moveKind']) if moves else {tuple(at)}   # 움직이는 적은 스스로 다가온다
            near = min((abs(a[0] - x) + abs(a[1] - y) for x, y in cells for a in own), default=99)
            if near > 1 and (states[t] == 3 or T[ty]['moveKind'] == 0 or near > 3):
                (warns if win or near <= 3 else errs).append(f'{w}: 적 [{t},{i}] {T[ty]["name"]} {at} 아군이 붙을 칸 없음 (가장 가까운 칸 {near}, 상태 {states[t]})')
    if VERBOSE: print(f'{w}: 출전 {k}/{len(party)} 칸 {len(rec["slots"])} 부대 {len(troops)} 조건 {len(cond)} 턴 {len(turn)}')
    return k


def applies(s, route, flags, party, items):
    has = lambda i: i in items or any(i in T[p]['equip'] for p in party)
    return ((not s.get('routes') or route in s['routes']) and (not s.get('flag') or s['flag'] in flags)
            and ('item' not in s or has(s['item'])) and ('noItem' not in s or not has(s['noItem'])))


def post(n, route, party, items, flags, rec, cond):
    for r in cond:   # 조건 합류·플래그 (선택 사건은 일어났다고 본다)
        for d in r['do']:
            if isinstance(d, dict) and 'join' in d and 'lose' not in r['do']: party.append(d['join'])
            if isinstance(d, dict) and 'flag' in d: flags.add(d['flag'])
    items += rec['reward']
    for s in SC['post'].get(str(n), []):
        if not applies(s, route, flags, party, items): continue
        if 'scene' in s: scene_ok(f'{n}장 전투 후', s['scene'])
        elif 'join' in s: party.append(s['join'])
        elif 'leave' in s: party[:] = [t for t in party if t != s['leave']]
        elif 'swap' in s: party[:] = [s['swap'][1] if t == s['swap'][0] else t for t in party]
        elif 'count' in s: del party[s['count']:]
        elif 'set' in s:
            while len(party) <= s['set'][0]: party.append(0)
            party[s['set'][0]] = s['set'][1]
        elif 'take' in s:
            if s['take'] in items: items.remove(s['take'])
        elif 'give' in s: items.append(s['give'])
        elif 'setFlag' in s: flags.add(s['setFlag'])


def run_route(route):
    rows, party, items, flags, seq = BT['route'], list(SC['party']), [], set(), []
    n, r = 1, 0
    while n is not None:
        seq.append(n)
        PLAN.append({'n': n, 'route': r, 'party': list(party), 'items': list(items), 'flags': sorted(flags)})
        rec = BT['records'].get(f'{n}-{r}')
        if rec is None:
            alt = next((f'{n}-{q}' for q in range(3) if f'{n}-{q}' in BT['records']), None)
            if alt is None: errs.append(f'{n}장 루트 {r}: 배치 없음'); break
            warns.append(f'{n}장 루트 {r}: 배치 없음 → {alt} 사용'); rec = BT['records'][alt]
        cond, turn = BT['cond'].get(str(n), []), BT['turn'].get(str(n), [])
        for key in SC['pre'].get(str(n), []): scene_ok(f'{n}장 전투 전', key)
        if f'{n:02d}' not in ECS: warns.append(f'{n}장: 개선판 대본 없음')
        check(n, r, party, items, flags, rec, cond, turn, f'{n}장', BT.get('start', {}).get(str(n), []))
        post(n, r, party, items, flags, rec, cond)
        last = any('ending' in c['do'] for c in cond)
        i = next((k for k, row in enumerate(rows) if k > 0 and row[r] == n), -1)
        nxt = rows[i + 1] if 0 <= i < len(rows) - 1 else None
        if nxt is None or nxt[r] == n:
            if not last: errs.append(f'루트 {route}: {n}장 뒤 다음 장 없는데 엔딩 조건 없음')
            n = None
        elif n == SC['routeSelectAfter']:
            r = route; n = nxt[route]
        else:
            if last: errs.append(f'루트 {route}: {n}장 엔딩 조건인데 다음 장 {nxt[r]} 있음')
            n = nxt[r]
        if len(seq) > 60: errs.append(f'루트 {route}: 장 순서 순환'); break
    return seq, party


def run_extra():
    for n, b in sorted(EXTRA.items()):
        check(b['map'], 0, list(b['party']), list(b.get('items', [])), set(), b['record'], b['cond'], b.get('turn', []), f'숨은 장 {n} ({b["title"]})')
        if 'next' in b and b['next'] not in EXTRA: errs.append(f'숨은 장 {n}: 다음 {b["next"]} 없음')
        if 'next' not in b and not any('ending' in c['do'] for c in b['cond']): errs.append(f'숨은 장 {n}: 다음 장도 엔딩도 없음')


seen = set()
for route in range(3):
    seq, party = run_route(route)
    seen.update(seq)
    print(f'루트 {route}: {len(seq)}장 {"-".join(map(str, seq))} / 끝 일행 {len(party)}명')
run_extra()
missing = sorted(set(range(1, 44)) - seen)
if missing: errs.append(f'어느 루트로도 가지 않는 장: {missing}')
errs, warns = list(dict.fromkeys(errs)), list(dict.fromkeys(warns))
from collections import Counter
for w, names in stuck.items(): print('배치', f'{w}: 자기 이동방식으로 못 서는 칸의 적·NPC {len(names)} ({", ".join(f"{k}×{v}" for k, v in Counter(names).items())})')
for x in warns: print('주의', x)
for x in errs: print('문제', x)
print(f'장 {len(seen)}개 + 숨은 장 {len(EXTRA)}개 · 문제 {len(errs)} · 주의 {len(warns)}')
if '--plan' in sys.argv:
    os.makedirs(os.path.join(R, 'build'), exist_ok=True)
    uniq = list({(p['n'], p['route']): p for p in PLAN}.values())
    json.dump(uniq, open(os.path.join(R, 'build', 'verify_plan.json'), 'w'))
    print(f'build/verify_plan.json: {len(uniq)}개')
sys.exit(1 if errs else 0)
