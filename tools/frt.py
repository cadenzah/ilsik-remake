"""FRT 이미지 컨테이너 파서. 포맷은 .claude/docs/formats.md 참고."""
import struct
import numpy as np

SIGS = (b'FRT', b'FGT')


def is_frt(data):
    return data[:3] in SIGS and data[3:6] == b'999'


def entries(data):
    """(index, offset, w, h, palette_bytes, rle_bytes) 를 순서대로 낸다."""
    count = struct.unpack_from('<H', data, 43)[0]
    p = 45
    for i in range(count):
        if data[p:p + 3] not in SIGS:
            raise ValueError(f'entry {i}: bad signature at {p:#x}')
        _, has_pal, w, h, size = struct.unpack_from('<HBHHI', data, p + 43)
        q = p + 54
        pal = data[q:q + 768] if has_pal else None
        if has_pal:
            q += 768
        yield i, p, w, h, pal, data[q:q + size]
        p = q + size


def unrle(rle, n):
    out = bytearray(n)
    i = j = 0
    L = len(rle)
    while j < n and i < L:
        b = rle[i]
        i += 1
        if b >= 0xC0:
            c = b & 0x3F
            v = rle[i]
            i += 1
            out[j:j + c] = bytes([v]) * min(c, n - j)
            j += c
        else:
            out[j] = b
            j += 1
    return bytes(out)


def palette8(pal):
    return bytes(min(255, c * 4) for c in pal)


def to_image(w, h, pal, rle):
    from PIL import Image
    img = Image.frombytes('P', (w, h), unrle(rle, w * h))
    img.putpalette(palette8(pal))
    return img
