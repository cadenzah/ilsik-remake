"""ECP.EXE (16비트 MZ) 분석 도우미. 이미지 로드·재배치·역어셈블·문자열/참조 검색.
사용: python tools/exe.py dis SEG:OFF [n]   |  refs DSOFF  |  str DSOFF"""
import struct, sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_16

EXE = 'original/ECP.EXE'
raw = open(EXE, 'rb').read()
hdr = struct.unpack('<14H', raw[:28])
HDR = hdr[4] * 16
img = bytearray(raw[HDR:])
relocs = [struct.unpack('<HH', raw[hdr[12] + 4*i: hdr[12] + 4*i + 4]) for i in range(hdr[3])]
# 재배치 위치 (선형) 집합: 그 자리 u16 = 세그먼트 값 (로드 베이스 0)
reloc_at = {s*16 + o for o, s in relocs}
md = Cs(CS_ARCH_X86, CS_MODE_16)

def lin(seg, off): return seg*16 + off

def dis(seg, off, n=40):
    code = bytes(img[lin(seg, off): lin(seg, off) + n*6])
    out = []
    for i, ins in enumerate(md.disasm(code, off)):
        if i >= n: break
        out.append(f'{seg:04x}:{ins.address:04x}  {ins.mnemonic} {ins.op_str}')
    return out

def cstr(at, maxlen=80):
    e = img.find(b'\0', at, at+maxlen)
    return bytes(img[at: e if e >= 0 else at+maxlen])

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'dis':
        s, o = (int(x, 16) for x in sys.argv[2].split(':'))
        print('\n'.join(dis(s, o, int(sys.argv[3]) if len(sys.argv) > 3 else 40)))
    elif cmd == 'segs':
        segs = sorted({struct.unpack_from('<H', img, a)[0] for a in reloc_at})
        print(len(segs), ' '.join(f'{x:04x}' for x in segs))

SEGS = [0x0,0xa19,0xaa2,0x124e,0x20ec,0x2ff8,0x33da,0x3544,0x35ae,0x3716,0x3821,0x3c05,0x3cd3,0x48e1,0x53a2,0x53fe,0x5675,0x573a]
DS = 0x573a

def sweep(seg):
    """세그먼트 선형 역어셈블 (해석 실패 시 1바이트 건너뜀). (ins) 생성."""
    i = SEGS.index(seg); end = SEGS[i+1] if i+1 < len(SEGS) else DS
    code = bytes(img[seg*16: end*16]); off = 0
    while off < len(code):
        last = off
        for ins in md.disasm(code[off:], off):
            yield ins; last = ins.address + ins.size
        off = max(last, off) + (1 if last == off else 0)

def func_start(seg, off):
    """off 이전 가장 가까운 함수 프롤로그 (push bp; mov bp,sp 또는 enter)."""
    base = seg*16
    for o in range(off, max(off-0x2000, 0), -1):
        b = img[base+o: base+o+3]
        if b == b'\x55\x8b\xec' or (b[0] == 0xc8 and img[base+o+3] == 0): return o
    return off

if __name__ == '__main__' and sys.argv[1] == 'fn':
    s, o = (int(x, 16) for x in sys.argv[2].split(':'))
    st = func_start(s, o)
    print('\n'.join(dis(s, st, int(sys.argv[3]) if len(sys.argv) > 3 else 80)))
