"""효과음 호출부 목록 (2026-10-16).
3716:04ae(파일 far 포인터, 번호) = 효과음 하나를 소리 버퍼(DS 0x391a)에 불러오기만 한다.
3716:0f17(종류, ?) = 불러 둔 것 재생 (종류 0 음악 0x3916 / 1 효과음 0x391a), 3716:0f8e(종류) = 멈춤.
3716:0c28(종류, 칸) = 캐시 칸 → 버퍼, 3716:0dac(종류, 칸) = 버퍼 → 캐시 칸 (256색 모드 전투에서 유닛별 공격음).
사용: python tools/sfx.py [list|ev|ctx SEG:OFF [n]]"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from exe import SEGS, DS, img, sweep, func_start, dis, cstr

S = 0x3716
NAMES = {0x04ae: 'load', 0x0f17: 'play', 0x0f8e: 'stop', 0x0c28: 'cget', 0x0dac: 'cput', 0x02d5: 'free'}


def _imm(op):
    try: return int(op, 16) if op.startswith('0x') else int(op)
    except ValueError: return None


def _arg(p):
    v = _imm(p.op_str)
    return v if v is not None else p.op_str


def events():
    """(seg, 위치, 종류, 인자들) — 인자는 push 순서를 뒤집은 C 인자 순."""
    for s in SEGS[:-1]:
        prev = []
        for i in sweep(s):
            op = None
            if i.mnemonic == 'lcall' and i.op_str.startswith(f'0x{S:x}, '): op = int(i.op_str.split(', ')[1], 16)
            elif s == S and i.mnemonic == 'call' and i.op_str.startswith('0x'): op = int(i.op_str, 16)
            if op in NAMES:
                ps = [p for p in prev if p.mnemonic == 'push']
                k = {'load': 3, 'play': 2, 'stop': 1, 'cget': 2, 'cput': 2, 'free': 1}[NAMES[op]]
                args = [_arg(p) for p in ps[-k:]][::-1]
                if NAMES[op] == 'load' and len(args) == 3 and args[1] == 'ds' and isinstance(args[0], int):
                    args = [cstr(DS*16 + args[0], 16).decode('latin1'), args[2]]
                yield s, i.address, NAMES[op], args
            prev = (prev + [i])[-8:]


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'ev'
    if cmd in ('ev', 'list'):
        for s, a, n, args in events():
            if cmd == 'list' and n != 'load': continue
            print(f'{s:04x}:{a:04x}  fn {func_start(s, a):04x}  {n:5} {args}')
    elif cmd == 'ctx':
        s, o = (int(x, 16) for x in sys.argv[2].split(':'))
        n = int(sys.argv[3]) if len(sys.argv) > 3 else 20
        print('\n'.join(dis(s, max(o - n*3, 0), n*2)))
