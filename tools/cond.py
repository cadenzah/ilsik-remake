"""전투 중 승패 조건 함수 124e:d4a7 (switch(stage)) 장별 요약 출력.
사용: python tools/cond.py [stage...]   — les 사슬을 U[부대.대원] 기호로 줄여 보여 준다."""
import sys, struct
sys.path.insert(0, 'tools')
import exe

SEG, TABLE, END = 0x124e, 0xe053, 0xe021
TROOP = 0x242   # 부대 구조체 크기. 대원 i 의 능력치 far ptr = 부대 + 4 + 4i

# 장별 조건 (124e:d4a7 을 손으로 옮긴 것, formats.md "전투 승패 조건"). 행동이 끝날 때마다 위에서부터 검사, 규칙마다 한 번만 발동.
# if: dead = 나열한 대원 모두 HP 0 / reach = U[0.0] 이 위치 p 도달 / hpBelow = [대원, 비율] / onlyLeft = 남은 적이 그 대원뿐
# do: win (+0x1d56=0) / lose / ending / state [[부대…], 값] (부대 +0x235) / scene "1:k" / join 유닛종류
# expect: 검증용 — 해당 대원의 유닛 종류 (모든 루트에서 맞아야 한다)
def _dead(*us, do): return {'if': {'dead': [list(u) for u in us]}, 'do': do}
COND = {
    3:  [_dead((1, 0), do=['lose'])],
    5:  [_dead((1, 0), do=['lose'])],
    7:  [_dead((1, 0), do=['lose']), _dead((1, 1), do=['lose'])],
    12: [_dead((1, 0), do=['lose'])],
    26: [_dead((1, 0), do=['win'])],
    27: [_dead((2, 0), do=['win']),
         {'if': {'hpBelow': [[0, 0], 0.25]}, 'do': [{'state': [[1], 0]}]}],  # 흑기사 출현, 메시지 상자 내용 미확인
    29: [_dead((1, 0), do=['win'])],
    32: [_dead((1, 0), do=['win'])],
    33: [_dead((1, 0), do=['lose']), _dead((3, 1), do=['win'])],
    35: [_dead((2, 0), do=[{'state': [[1, 2, 3, 4], 0]}, {'scene': '1:35'}]),
         _dead((1, 0), (2, 0), do=['win'])],
    36: [{'if': {'reach': 47}, 'do': ['win']}],
    37: [{'if': {'reach': 66}, 'do': ['win']}],
    38: [_dead((2, 0), do=['win', {'scene': '1:381'}]),
         {'if': {'onlyLeft': [2, 0]}, 'do': [{'join': 28}, 'win', {'scene': '1:382'}]}],
    39: [_dead((1, 0), do=['win'])],
    41: [_dead((1, 0), do=['win'])],
    42: [_dead((1, 0), do=['win'])],
    43: [_dead((2, 0), do=[{'state': [[1], 3]}, {'state': [[3, 4], 0]}, {'scene': '1:43'}]),
         _dead((1, 0), (1, 1), do=['ending'])],
}
EXPECT = {(3, 1, 0): 100, (5, 1, 0): 22, (7, 1, 0): 3, (7, 1, 1): 17, (12, 1, 0): 10, (26, 1, 0): 92, (27, 2, 0): 91,
          (29, 1, 0): 89, (32, 1, 0): 91, (33, 1, 0): 15, (33, 3, 1): 91, (35, 1, 0): 89, (35, 2, 0): 92, (38, 2, 0): 94,
          (39, 1, 0): 96, (41, 1, 0): 93, (42, 1, 0): 90, (43, 1, 0): 98, (43, 1, 1): 99, (43, 2, 0): 97}


def troops(p):
    """BAD 레코드 → 부대 0 이후의 [[유닛종류…], 초기상태] (부대 1 = NPC 가 있으면 NPC)."""
    t = [[p['npc']['types'], p['npc']['flag']]] if p['npc']['types'] else []
    return t + [[g['types'], g['active']] for g in p['groups']]


def table():
    base = SEG*16
    return {i+3: struct.unpack_from('<H', exe.img, base + TABLE + 2*i)[0] for i in range(41)}

def unit(off):
    t, r = divmod(off, TROOP)
    return f'U[{t}.{(r-4)//4}]' if r >= 4 and r % 4 == 0 else f'troop+0x{off:x}'

def case(start, stop):
    out, ins = [], [i for i in exe.md.disasm(bytes(exe.img[SEG*16+start: SEG*16+stop]), start)]
    k = 0
    while k < len(ins):
        a = ins[k]
        # les bx,[bp+6]; les bx,es:[bx+0x1be6]; les bx,es:[bx+X]  →  U
        if k+2 < len(ins) and a.op_str == 'bx, ptr [bp + 6]' and '0x1be6' in ins[k+1].op_str and ins[k+2].mnemonic == 'les':
            off = ins[k+2].op_str.split('+ ')[-1].rstrip(']')
            out.append(f'{a.address:04x}  = {unit(int(off, 16))}'); k += 3; continue
        if a.op_str == 'bx, ptr [bp + 6]' and k+1 < len(ins):
            b = ins[k+1]; out.append(f'{a.address:04x}  B.{b.mnemonic} {b.op_str.replace("es:[bx + ", "[")}'); k += 2; continue
        out.append(f'{a.address:04x}  {a.mnemonic} {a.op_str}'); k += 1
    return out

if __name__ == '__main__':
    if sys.argv[1:] == ['check']:
        import bad
        R, RT = bad.load(), bad.route_table()
        bad_ = 0
        for s, r in sorted({(s, j) for row in RT[1:] for j, s in enumerate(row)}):
            T = [None] + troops(bad.parse(R[(s-1)*3+r]))
            for (st, t, m), want in EXPECT.items():
                if st != s: continue
                got = T[t][0][m] if t < len(T) and m < len(T[t][0]) else None
                if got != want: print('mismatch', s, r, f'U[{t}.{m}]', got, '!=', want); bad_ += 1
        print('expect mismatches', bad_)
        sys.exit()
    t = table()
    starts = sorted(set(t.values()) | {END})
    want = [int(x) for x in sys.argv[1:]] or [s for s in t if t[s] != END]
    for s in want:
        st = t[s]
        if st == END: print(f'== {s}: 없음'); continue
        print(f'== {s} ({st:04x})')
        print('\n'.join(case(st, starts[starts.index(st)+1])))
