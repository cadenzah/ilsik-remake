"""전투 중 승패 조건 함수 124e:d4a7 (switch(stage)) 장별 요약 출력.
사용: python tools/cond.py [stage...]   — les 사슬을 U[부대.대원] 기호로 줄여 보여 준다."""
import sys, struct
sys.path.insert(0, 'tools')
import exe

SEG, TABLE, END = 0x124e, 0xe053, 0xe021
TROOP = 0x242   # 부대 구조체 크기. 대원 i 의 능력치 far ptr = 부대 + 4 + 4i

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
    t = table()
    starts = sorted(set(t.values()) | {END})
    want = [int(x) for x in sys.argv[1:]] or [s for s in t if t[s] != END]
    for s in want:
        st = t[s]
        if st == END: print(f'== {s}: 없음'); continue
        print(f'== {s} ({st:04x})')
        print('\n'.join(case(st, starts[starts.index(st)+1])))
