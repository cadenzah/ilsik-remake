"""FRTWND / FRTBTN UI 조각 컨테이너 (ECPBAS/BUT/COM/LEV/MAG/MAI/SPE.ECP, MAIN.ECP). 포맷은 formats.md.
사용: python tools/frtwnd.py list FILE           항목 요약
      python tools/frtwnd.py png FILE OUTDIR [PALFILE [PALIDX]]   항목을 PNG 로 (팔레트는 FRT 이미지에서 빌림)"""
import os, struct, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import frt

SIGS = (b'FRTWND', b'FRTBTN')


def entries(data):
    """(index, name, kind, w, h, pixels bytes) — 무압축 인덱스 픽셀, 팔레트 없음."""
    assert data[:6] in SIGS, data[:8]
    count = struct.unpack_from('<H', data, 13)[0]
    p = 15
    for i in range(count):
        assert data[p:p + 3] == b'FRT', (i, hex(p))
        name = data[p + 3:p + 13].split(b'\0')[0].rstrip(b'9').decode()
        kind, w, h, size = struct.unpack_from('<HHHI', data, p + 13)
        q = p + 23
        yield i, name, kind, w, h, data[q:q + size]
        p = q + size


def palette(path, idx=0):
    data = open(path, 'rb').read()
    for i, _, _, _, pal, _ in frt.entries(data):
        if i == idx:
            return bytes(min(255, b * 4) for b in pal)
    raise IndexError(idx)


def image(w, h, px, pal):
    im = Image.frombytes('P', (w, h), bytes(px[:w * h]).ljust(w * h, b'\0'))
    im.putpalette(pal)
    return im


if __name__ == '__main__':
    cmd, f = sys.argv[1], sys.argv[2]
    data = open(f, 'rb').read()
    if cmd == 'list':
        print(data[:6].decode(), 'count', struct.unpack_from('<H', data, 13)[0])
        for i, name, kind, w, h, px in entries(data):
            print(f'{i:3d} {name:10s} kind={kind:#06x} {w}x{h} size={len(px)}')
    elif cmd == 'png':
        out = sys.argv[3]
        os.makedirs(out, exist_ok=True)
        pal = palette(sys.argv[4], int(sys.argv[5]) if len(sys.argv) > 5 else 0) if len(sys.argv) > 4 \
            else bytes(np.repeat(np.arange(256, dtype=np.uint8), 3))
        for i, name, kind, w, h, px in entries(data):
            image(w, h, px, pal).convert('RGB').save(os.path.join(out, f'{i:03d}_{name}.png'))
