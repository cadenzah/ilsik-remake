"""FP 에뮬(int 34h~3Dh) 치환 역어셈블. 사용: python tools/fpdis.py SEG:OFF [n]
- CD 34..3B → 9B D8..DF, CD 3D → 90 9B (fwait), CD 3C → 세그 오버라이드 (26/2E/36/3E 추정) + ESC
- DS 상수 참조 [0xNNNN] 에 float/double 값 주석"""
import struct, sys, re
sys.path.insert(0, 'tools')
import exe
img = exe.img
p = bytearray(img)
i = 0
while i < len(p) - 1:
    if p[i] == 0xCD and 0x34 <= p[i+1] <= 0x3B:
        p[i] = 0x9B; p[i+1] += 0xA4; i += 2; continue
    if p[i] == 0xCD and p[i+1] == 0x3D:
        p[i] = 0x90; p[i+1] = 0x9B; i += 2; continue
    if p[i] == 0xCD and p[i+1] == 0x3C:
        b = p[i+2]  # Borland: 상위 2비트 = 세그 (0 DS?,1 SS,2 CS,3 ES 추정), 하위 = ESC D8|x
        seg = {0: 0x3E, 1: 0x36, 2: 0x2E, 3: 0x26}[b >> 6]
        p[i] = 0x9B; p[i+1] = seg; p[i+2] = 0xD8 | (b & 7); i += 3; continue
    i += 1
DSB = exe.DS * 16

def note(op, mn):
    m = re.search(r'(dword|qword|tbyte) ptr \[(0x[0-9a-f]+)\]', op)
    if not m or not mn.startswith('f'): return ''
    a = DSB + int(m.group(2), 16)
    if a + 8 > len(img): return ""
    if m.group(1) == 'dword': return f'   ; {struct.unpack_from("<f", img, a)[0]:g}'
    if m.group(1) == 'qword': return f'   ; {struct.unpack_from("<d", img, a)[0]:g}'
    return ''

def dis(seg, off, n=60):
    code = bytes(p[seg*16+off: seg*16+off+n*7])
    out = []
    for k, ins in enumerate(exe.md.disasm(code, off)):
        if k >= n: break
        if ins.mnemonic in ('wait', 'nop'): continue
        out.append(f'{seg:04x}:{ins.address:04x}  {ins.mnemonic} {ins.op_str}{note(ins.op_str, ins.mnemonic)}')
    return out

if __name__ == '__main__':
    s, o = (int(x, 16) for x in sys.argv[1].split(':'))
    print('\n'.join(dis(s, o, int(sys.argv[2]) if len(sys.argv) > 2 else 60)))

def far_calls(seg, off):
    """far call seg:off (9A off seg) 위치 → (세그, 오프셋) 목록"""
    pat = bytes([0x9A]) + struct.pack('<HH', off, seg)
    res = []; i = p.find(pat)
    while i >= 0:
        s = max(x for x in exe.SEGS if x*16 <= i); res.append((s, i - s*16)); i = p.find(pat, i+1)
    return res

if __name__ == '__main__' and False: pass
