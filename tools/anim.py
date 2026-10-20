"""컷신 (FAT 묶음) 재생 호출부 요약 (2026-10-17).
48e1:7a1e(애니, 파일, 묶음) = 묶음 불러오기, 48e1:8647(애니, x, y, 프레임) = 프레임 그리기, 48e1:aaa0(애니) = 프레임 수, 48e1:aab0(애니) = 풀기,
48e1:aaea(ms, 0) = 기다림, 48e1:ab16 = 기다림 끝 (키 입력 확인 [추정]), 48e1:0e92(팔레트, 모드) = 팔레트 효과, 0aa2:4138(장면, 단계) = 대화 장면.
사용: python tools/anim.py [list | trace SEG:OFF [바이트]]"""
import os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from exe import SEGS, sweep, md, img, cstr, DS

NAMES = {('0x48e1', '0x7a1e'): 'LOAD', ('0x48e1', '0x8647'): 'DRAW', ('0x48e1', '0xaaa0'): 'NFRAMES', ('0x48e1', '0xaab0'): 'FREE',
         ('0x48e1', '0xaaea'): 'WAIT', ('0x48e1', '0xab16'): 'WAITEND', ('0x48e1', '0xe92'): 'PAL', ('0xaa2', '0x4138'): 'SCENE',
         ('0x3716', '0x4ae'): 'SLOAD', ('0x3716', '0xf17'): 'SPLAY', ('0x3716', '0xf8e'): 'SSTOP', ('0x3716', '0xc28'): 'SGET',
         ('0x3716', '0xdac'): 'SPUT', ('0x3716', '0x42'): 'SCACHE', ('0x3716', '0x2d5'): 'SFREE'}


def sites():
    for s in SEGS[:-1]:
        prev = []
        for i in sweep(s):
            if i.mnemonic == 'lcall' and i.op_str == '0x48e1, 0x7a1e':
                ps = [p.op_str for p in prev if p.mnemonic == 'push'][-5:]
                yield s, i.address, ps[0], cstr(DS * 16 + int(ps[2], 16), 16).decode('latin1')
            prev = (prev + [i])[-8:]


def trace(seg, off, n=0x200):
    """off 부터 n 바이트: 이름 붙은 호출 (인자 = 앞 push 들, C 순) 과 비교·분기만."""
    prev = []
    for i in md.disasm(bytes(img[seg * 16 + off: seg * 16 + off + n]), off):
        if i.mnemonic == 'lcall':
            a = tuple(i.op_str.split(', '))
            name = NAMES.get(a, i.op_str)
            ps = [p.op_str for p in prev if p.mnemonic == 'push'][::-1]
            print(f'  {i.address:04x} {name:8} {", ".join(ps[:5])}')
            prev = []; continue
        if i.mnemonic == 'cmp' or i.mnemonic.startswith('j') or i.mnemonic in ('inc', 'dec') and 'di' in i.op_str \
                or i.mnemonic == 'mov' and re.search(r'^(di|si), ', i.op_str):
            print(f'  {i.address:04x} {i.mnemonic} {i.op_str}')
        if i.mnemonic == 'retf': break
        prev = (prev + [i])[-10:]


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    if cmd == 'list':
        for s, a, k, f in sites(): print(f'{s:04x}:{a:04x}  {f:14} 묶음 {k}')
    elif cmd == 'trace':
        s, o = (int(x, 16) for x in sys.argv[2].split(':'))
        trace(s, o, int(sys.argv[3], 0) if len(sys.argv) > 3 else 0x200)
