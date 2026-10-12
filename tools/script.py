"""ECP.EXE 대화 장면 추출. 장면 함수 0aa2:4138(scene, phase) 안의 하드코딩된 대사 호출을 순서대로 뽑는다.
  0aa2:2ed2 = 주고받기: DS 레코드 6B {인물A u8, 인물B u8, 줄A u16, 줄B u16}
  0aa2:2da8 = 단독 대사 (인물, 줄)      인물 = ECLIPSE2.PAD 유닛 번호, 줄 = ECLIPSE.FNT 번호
  0aa2:310a = 범위 대화 (인물 A·B 번갈아 줄 start~)   0aa2:2b55 직접 호출 = 초상화 없는 줄
phase: 0 = 전투 시작(124e:c3da switch), 1 = 전투 중 트리거(124e:d4a7), 2 = 전투 후(2ff8 캠페인 루프)
사용: python tools/script.py [list|flow|gaps|dups|ev|calls]"""
import os, re, struct, sys
sys.path.insert(0, os.path.dirname(__file__))
from exe import img, md, SEGS, sweep, DS
SEG, START = 0xaa2, 0x4138
INITIAL_PARTY = [0, 18, 27]  # 2ff8:1681 아리크스·레스다·소피아


def body(seg=SEG, start=START):
    """함수 본문 명령 목록 (첫 retf 까지)."""
    out = []
    for ins in md.disasm(bytes(img[seg*16 + start: seg*16 + start + 0x6000]), start):
        out.append(ins)
        if ins.mnemonic == 'retf': break
    return out


def imm(ins):
    m = re.fullmatch(r'0x[0-9a-f]+|\d+', ins.op_str)
    return int(m.group(), 0) if ins.mnemonic == 'push' and m else None


def events():
    """(주소, 종류, 값...) 를 순서대로. 종류: phase / scene / pair / say / cond"""
    ins = body(); ev = []
    for k, i in enumerate(ins):
        a, mn, op = i.address, i.mnemonic, i.op_str
        if mn == 'cmp' and op.startswith('byte ptr [bp + 8]'):
            ev.append((a, 'phase', ins[k+2].op_str))  # cmp [bp+8],0; je A; jmp B  → phase≠0 은 B
        elif mn == 'cmp' and op.startswith('si, '):
            n = int(op[4:], 0); j1, j2 = ins[k+1], ins[k+2]
            # cmp si,N; je A; jmp B  →  장면 N = [A, B)      cmp si,N; jne B  →  [다음, B)
            if j1.mnemonic == 'je' and j2.mnemonic == 'jmp':
                ev.append((a, 'scene', n, int(j1.op_str, 0), int(j2.op_str, 0)))
            elif j1.mnemonic == 'jne':
                ev.append((a, 'scene', n, j1.address + j1.size, int(j1.op_str, 0)))
            else:
                ev.append((a, 'scene?', n, mn, j1.mnemonic))
        elif mn == 'cmp':
            ev.append((a, 'cond', op, ins[k+1].mnemonic, ins[k+1].op_str))
        elif mn == 'call' and op == '0x2ed2':
            # mov ax,[X]; ... mov ax,[X+2] (dx:ax = [X+4]:[X+2]) — 가장 가까운 것이 X+2
            src = next(int(m.group(1), 16) for p in reversed(ins[max(k-30, 0):k])
                       if (m := re.fullmatch(r'ax, word ptr \[0x([0-9a-f]+)\]', p.op_str))) - 2
            ca, cb = img[DS*16 + src], img[DS*16 + src + 1]
            la, lb = struct.unpack_from('<2H', img, DS*16 + src + 2)
            ev.append((a, 'pair', ca, la, cb, lb))
        elif mn == 'call' and op == '0x310a':
            # 범위 대화: 인물 A·B 가 줄 start 부터 번갈아, 줄 end 에 닿거나 n 번 주고받으면 끝
            # 인자 push 순서: 표seg, 표off, n, end, start, ss, &인물쌍, (ss, buf)×3, cs
            ps = [p for p in ins[max(k-20, 0):k] if p.mnemonic == 'push']
            n, end, st = imm(ps[-12]), imm(ps[-11]), imm(ps[-10])
            src = next(int(m.group(1), 16) for p in reversed(ins[max(k-24, 0):k])
                       if (m := re.fullmatch(r'ax, word ptr \[0x([0-9a-f]+)\]', p.op_str)))
            ca, cb = img[DS*16 + src], img[DS*16 + src + 1]
            seq, line = [], st
            for _ in range(n):
                seq.append((ca, line)); line += 1
                if line == end: break
                seq.append((cb, line)); line += 1
            ev.append((a, 'range', st, end, n, seq))
        elif mn == 'call' and op == '0x2b55':
            # 인자 push 순서: 플래그, 줄, ds, 파일명, y, x, cs
            ps = [p for p in ins[max(k-10, 0):k] if p.mnemonic == 'push']
            ev.append((a, 'narr', imm(ps[-6])))
        elif mn == 'call' and op == '0x2da8':
            # 인자 push 순서: 표seg, 표off, 줄, 인물, ss, buf, ss, buf, cs
            ps = [p for p in ins[max(k-14, 0):k] if p.mnemonic == 'push']
            ev.append((a, 'say', imm(ps[-6]), imm(ps[-7])))
    return ev


def scenes():
    """{(phase, scene): [(인물, 줄, 분기), ...]} — 같은 장면 번호가 두 phase 에 나올 수 있다.
    인물 -1 = 초상화 없음. 분기 0 = 항상, 1 = 선택지 '예', 2 = '아니오' (장면 안 cmp; je 구조)."""
    ev = events()
    # phase 0 블록 뒤에 'cmp ax,1 / cmp ax,2' 로 phase 1·2 블록이 이어진다
    starts = sorted([0] + [int(e[4], 0) for e in ev if e[1] == 'cond' and e[2] in ('ax, 1', 'ax, 2') and e[3] == 'je'])
    phase_of = lambda a: max(i for i, s in enumerate(starts) if a >= s)
    sc = [e for e in ev if e[1] == 'scene']
    out = {}
    for _, _, n, lo, hi in sc:
        key = (phase_of(lo), n)
        # 장면 안 분기: cmp X,0; je ELSE ... jmp END; ELSE: ... END
        br, ends = [], {i.address + i.size: i for i in body()}
        for e in ev:
            if lo <= e[0] < hi and e[1] == 'cond' and e[3] == 'je':
                els = int(e[4], 0)
                end = int(ends[els].op_str, 0)  # ELSE 직전 jmp END
                br.append((e[0], els, end))
        tag = lambda a: next((1 if a < els else 2 for c, els, end in br if c < a < end), 0)
        lines = []
        for e in ev:
            if lo <= e[0] < hi:
                t = tag(e[0])
                if e[1] == 'pair': lines += [(e[2], e[3], t), (e[4], e[5], t)]
                elif e[1] == 'say': lines.append((e[2], e[3], t))
                elif e[1] == 'narr': lines.append((-1, e[2], t))
                elif e[1] == 'range': lines += [x + (t,) for x in e[5]]
        out.setdefault(key, []).extend(lines)
    return out


def calls():
    """장면 함수 호출부: (호출 위치, scene, phase) — 인자가 즉치값일 때만."""
    for s in SEGS:
        prev = []
        for i in sweep(s):
            prev = (prev + [i])[-8:]
            if i.mnemonic == 'lcall' and i.op_str == f'0x{SEG:x}, 0x{START:x}' or \
               (s == SEG and i.mnemonic == 'call' and i.op_str == f'0x{START:x}'):
                ps = [p for p in prev[:-1] if p.mnemonic == 'push' or p.mnemonic == 'mov']
                yield s, i.address, [f'{p.mnemonic} {p.op_str}' for p in ps[-4:]]


def _scene_call(prev):
    # push phase; push scene; lcall 0aa2:4138
    ps = [imm(p) for p in prev if p.mnemonic == 'push'][-2:]
    return tuple(ps[::-1]) if len(ps) == 2 else None


def prebattle():
    """124e:c3da 전투 시작: switch(stage) 의 각 case 가 부르는 장면 [(scene, phase)]."""
    seg, tbl = 0x124e, 0xd42b          # jmp cs:[bx-0x2bd5], bx = (stage-1)*2, 43 case
    out = {}
    for st in range(1, 44):
        tgt = struct.unpack_from('<H', img, seg*16 + tbl + (st-1)*2)[0]
        prev, got = [], []
        for i in md.disasm(bytes(img[seg*16 + tgt: seg*16 + tgt + 0x800]), tgt):
            if i.mnemonic == 'jmp' and i.op_str == '0xd3ff': break
            if i.mnemonic == 'lcall' and i.op_str == '0xaa2, 0x4138': got.append(_scene_call(prev))
            prev = (prev + [i])[-6:]
        out[st] = got
    return out


# 캠페인 플래그 = 캠페인 루프 지역 (전투구조체 +0x1d3c / +0x1d3e 와 같은 칸)
FLAG_NAME = {'13c': 'npc19',    # 19장 끝에 용왕(U[1.0]) 생존 (2ff8:28a3) → 36장 루이스(23) 출현·합류
             '13a': 'black27'}  # 27장 아리크스 HP < 25% 로 흑기사 출현 → 27장 후 아보라한(24) 합류·장면 272
POST_FLAG = {}


def postbattle():
    """2ff8:1925~ 전투 후: '현재 스테이지 == S' 블록마다 [('join', 유닛, 루트) | ('scene', scene, phase, 루트) | ('cond', ..)].
    루트 = 그 사건을 감싼 'cmp [bp-0x13e], N' 블록들의 루트 집합 (None = 모든 루트). je 로 이어진 비교는 OR.
    캠페인 플래그 블록 'cmp [bp-0x13c|0x13a], 1; jne' 안의 join·scene 은 POST_FLAG[(장, 순번)] 에 플래그 이름."""
    seg, lo, hi = 0x2ff8, 0x1925, 0x3b91
    out, cur, prev = {}, None, []
    blocks, pend = [], set()  # 루트 블록 [(루트 집합, 끝 주소)], je 로 모으는 중인 루트
    flags = []                # 플래그 블록 [(이름, 끝 주소)]
    ins = list(md.disasm(bytes(img[seg*16 + lo: seg*16 + hi]), lo))

    def routes(a):
        blocks[:] = [b for b in blocks if a < b[1]]
        rs = {0, 1, 2}
        for r, _ in blocks: rs &= r
        flags[:] = [f for f in flags if a < f[1]]
        if flags: POST_FLAG[(cur, len(out[cur]))] = flags[-1][0]
        return None if rs == {0, 1, 2} else sorted(rs)
    for k, i in enumerate(ins):
        if i.mnemonic == 'cmp' and i.op_str.startswith('byte ptr ss:[bx], ') and ins[k-2].op_str == 'ax, [bp - 0x21fe]':
            # 전투 순서표[전투][루트] == S (같은 꼴의 [bp-0x1a4] 비교는 소지품 검사)
            cur = int(i.op_str.split(', ')[1], 0); out.setdefault(cur, []); blocks.clear(); pend = set()
        elif cur is None: pass
        elif i.mnemonic == 'mov' and i.op_str == 'al, byte ptr [bp - 0x216f]':
            # 2ff8:3947 장 블록 다음: 전투 결과 == 2 (43장 엔딩, 124e:d4a7 반환 2) → 엔딩 장면 2:43
            cur = 43; out.setdefault(cur, []); blocks.clear(); pend = set()
        elif i.mnemonic == 'cmp' and (m := re.fullmatch(r'word ptr \[bp - 0x(13c|13a)\], 1', i.op_str)) \
                and ins[k+1].mnemonic == 'jne':
            flags.append((FLAG_NAME[m.group(1)], int(ins[k+1].op_str, 0)))
            out[cur].append(('cond', i.op_str, hex(i.address)))
        elif i.mnemonic == 'cmp' and (m := re.fullmatch(r'word ptr \[bp - 0x13e\], (\d)', i.op_str)):
            pend.add(int(m.group(1))); j = ins[k+1]
            if j.mnemonic == 'jne': blocks.append((set(pend), int(j.op_str, 0))); pend = set()
            out[cur].append(('cond', i.op_str, hex(i.address)))
        elif i.mnemonic == 'inc' and i.op_str == 'word ptr [bp - 0x1c3]':
            # 일행 수 +1 후 일행[수] = 유닛
            m = next(p for p in ins[k+1:k+8] if p.op_str.startswith('word ptr ss:[bx], '))
            out[cur].append(('join', int(m.op_str.split(', ')[1], 0), routes(i.address)))
        elif i.mnemonic == 'mov' and (m := re.fullmatch(r'word ptr \[bp - 0x(1c3|1c1|1bf|1bd|1bb|1b9|1b7|1b5|1b3)\], (\w+)', i.op_str)):
            # 일행 배열 직접 대입: [bp-0x1c3] = 수, [bp-0x1c1-2k] = k번째 유닛 (2ff8:1681 이 초기값)
            k = (0x1c1 - int(m.group(1), 16)) // 2
            out[cur].append(('count', int(m.group(2), 0)) if k < 0 else ('set', k, int(m.group(2), 0)))
        elif i.mnemonic == 'lcall' and i.op_str == '0xaa2, 0x4138':
            out[cur].append(('scene',) + (_scene_call(prev) or ('?', '?')) + (routes(i.address),))
        elif i.mnemonic == 'cmp':
            out[cur].append(('cond', i.op_str, hex(i.address)))
        prev = (prev + [i])[-6:]
    return out


def triggers():
    """전투 중 트리거 장면 (phase 1) 호출 위치. 조건은 대개 특정 유닛 HP(+0x22)==0 [추정]."""
    out = []
    for s, a, ps in calls():
        v = [int(p.split()[-1], 0) for p in ps if re.fullmatch(r'push (0x[0-9a-f]+|\d+)', p)][-2:]
        if len(v) == 2 and v[0] == 1: out.append((v[1], f'{s:04x}:{a:04x}'))
    return out


# 일행 배열을 훑으며 고치는 블록 (손으로 옮김): leave = 그 종류 대원 빼기, swap = 종류 교체, promote = +0x62 (직업 단계 추정) +1
POST_EXTRA = {
    17: [{'leave': 3}],                        # 2ff8:2749 페니 실종 (폭탄 함정)
    19: [{'leave': 22}],                       # 2ff8:28ec 루이스 염룡곡에 남음 (용왕 U[1.0] 생존 검사 0x289c 는 npc19 플래그)
    21: [{'swap': [19, 20], 'item': 179}],     # 2ff8:2b66 고대은화 → 수호자 강화
    37: [{'swap': [25, 26]}],                  # 2ff8:34e2 아티스 → 새 현자 (크란의 마법력)
    40: [{'promote': 16, 'if62': 7}],          # 2ff8:37c7 레이몬 +0x62 == 7 이면 +1 (마수신과 피의 서약)
}


def _post(e, key):
    """postbattle 사건 → scenes.json post 항목. routes 가 있으면 그 루트(0~2)에서만."""
    d = ({'join': e[1]} if e[0] == 'join' else {'count': e[1]} if e[0] == 'count'
         else {'set': list(e[1:])} if e[0] == 'set' else {'scene': f'{e[2]}:{e[1]}'})
    r = e[2] if e[0] == 'join' else e[3] if e[0] == 'scene' else None
    if r is not None: d['routes'] = r
    if f := POST_FLAG.get(key): d['flag'] = f
    if key[0] == 13 and e[0] in ('join', 'scene'):
        # 2ff8:23fb 소지품·장비에 요정피리(168, 9장 금괴 선택 '예') → 수호자(19) 합류·장면 131·132, 없으면 장면 13
        d['noItem' if e[0] == 'scene' and e[1] == 13 else 'item'] = 168
    return d


def export():
    """웹용 scenes.json 구조."""
    sc = scenes()
    out = {
        'scenes': {f'{ph}:{n}': [list(x) for x in ls] for (ph, n), ls in sorted(sc.items())},
        'pre': {st: [f'{ph}:{n}' for n, ph in v if (ph, n) in sc] for st, v in prebattle().items()},
        'party': INITIAL_PARTY,
        'post': {st: [_post(e, (st, k)) for k, e in enumerate(v)
                      if e[0] in ('join', 'count', 'set') or (e[0] == 'scene' and (e[2], e[1]) in sc)]
                 for st, v in postbattle().items()},
        'routeSelectAfter': 9,  # 9장 후 '진로선택' 메뉴 (0aa2:0b0d) 결과 = 루트 0~2
        'trigger': sorted({f'1:{n}' for n, _ in triggers() if (1, n) in sc}),
    }
    for st, xs in POST_EXTRA.items():
        out['post'].setdefault(st, [])[:0] = [dict(x) for x in xs]
    return out


if __name__ == '__main__':
    import json
    L = json.load(open('public/assets/data/dialogue.json'))
    N = {u['id']: u['name'] for u in json.load(open('public/assets/data/units.json'))}
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    if cmd == 'list':
        for (ph, n), ls in sorted(scenes().items()):
            print(f'== phase {ph} scene {n}')
            for x in ls:
                print(f'   {x[1]:3} {["  ", "예", "아니오"][x[2]]} {N.get(x[0], "-")}: {L[x[1]][:40]}')
    elif cmd == 'calls':
        for s, a, ps in calls(): print(f'{s:04x}:{a:04x}', ' | '.join(ps))
    elif cmd == 'ev':
        for e in events(): print(hex(e[0]), *e[1:])
    elif cmd == 'flow':
        pre, post = prebattle(), postbattle()
        for st in range(1, 44):
            print(f'{st:2} 전: {pre[st]}   후: {[e if e[0] != "join" else ("join", N[e[1]]) for e in post.get(st, [])]}')
    elif cmd == 'gaps':
        got = {x[1] for ls in scenes().values() for x in ls}
        miss = [i for i in range(len(L)) if i not in got]
        runs, st = [], None
        for i in miss:
            if st is None or i != prev + 1:
                if st is not None: runs.append((st, prev))
                st = i
            prev = i
        runs.append((st, prev))
        print(len(got), 'covered;', ' '.join(f'{a}-{b}' if a != b else str(a) for a, b in runs))
    elif cmd == 'triggers':
        print(triggers())
    elif cmd == 'dups':
        # 빠진 줄 중 쓰이는 줄과 거의 같은 것 (미사용 사본 판정)
        import difflib
        got = sorted({x[1] for ls in scenes().values() for x in ls})
        for i in range(len(L)):
            if i in got: continue
            best = max(got, key=lambda j: difflib.SequenceMatcher(None, L[i], L[j]).ratio())
            r = difflib.SequenceMatcher(None, L[i], L[best]).ratio()
            print(f'{i:3} ~{best:3} {r:.2f} {L[i][:30]}')
