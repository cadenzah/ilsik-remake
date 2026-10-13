"""FAT 애니메이션 묶음 풀기 (ECPTIT.FAT, ECLIPSE1~3.FAT) — 2026-10-14 확인.
구조: "FAT" + 공백 = 43바이트, u16 묶음 수. 묶음마다 팔레트 768 (6비트) + u32 폭 + u32 높이 + 바탕 그림 (PCX식 RLE:
바이트 >= 0xC0 이면 하위 6비트 = 반복 수, 다음 바이트 = 값) + FLC 프레임 묶음 (u32 크기, u16 프레임 수, 프레임 = u32 크기·u16 0xF1FA·u16 덩어리 수·8B,
덩어리 = u32 크기·u16 종류: 4/11 팔레트, 7 단어 변화(SS2), 12 줄 변화(LC), 13 검정, 15 BRUN, 16 복사). 묶음 사이 간격이 일정하지 않아
"팔레트(모두 ≤ 0x3f) 768B 바로 뒤의 그럴듯한 폭·높이"로 묶음 머리를 찾는다.
ECLIPSE1.FAT = 장 사이 컷신 (ECPMAI "mapwin" 504×384 틀 안), ECLIPSE2.FAT = 사바카 부활, ECLIPSE3.FAT = 엔딩, ECPTIT.FAT = 타이틀.
사용: python tools/fat.py 파일 출력폴더 [매 N 프레임마다 저장, 기본 0 = 첫·끝만]"""
import os, struct, sys
from PIL import Image


def heads(b):
    out = []
    for H in range(768, len(b) - 8):
        w, h = struct.unpack_from('<II', b, H)
        if 64 <= w <= 640 and 64 <= h <= 480 and b[H - 1] <= 0x3f and b[H - 768] <= 0x3f and max(b[H - 768:H]) <= 0x3f:
            out.append(H)
    return out


def rle(b, i, n):
    out = bytearray()
    while len(out) < n:
        c = b[i]; i += 1
        if c >= 0xC0: out += bytes([b[i]]) * (c & 0x3F); i += 1
        else: out.append(c)
    return out[:n], i


def chunk(px, pal, w, h, t, d):
    if t in (4, 11):   # 팔레트
        n = struct.unpack_from('<H', d, 0)[0]; p = 2; idx = 0
        for _ in range(n):
            idx += d[p]; cnt = d[p + 1] or 256; p += 2
            for k in range(cnt):
                v = d[p:p + 3]; p += 3
                pal[(idx + k) * 3:(idx + k) * 3 + 3] = [min(255, x * 4) if t == 11 else x for x in v]
            idx += cnt
    elif t == 7:   # SS2
        lines = struct.unpack_from('<H', d, 0)[0]; p = 2; y = 0
        while lines > 0:
            op = struct.unpack_from('<h', d, p)[0]; p += 2
            if op & 0xC000 == 0xC000: y += -op; continue
            if op & 0xC000 == 0x8000: px[y * w + w - 1] = op & 0xFF; continue
            x = 0
            for _ in range(op):
                x += d[p]; c = struct.unpack_from('<b', d, p + 1)[0]; p += 2
                if c > 0:
                    px[y * w + x:y * w + x + 2 * c] = d[p:p + 2 * c]; p += 2 * c; x += 2 * c
                else:
                    px[y * w + x:y * w + x - 2 * c] = d[p:p + 2] * (-c); p += 2; x += -2 * c
            y += 1; lines -= 1
    elif t == 12:   # LC
        y0, n = struct.unpack_from('<HH', d, 0); p = 4
        for y in range(y0, y0 + n):
            pk = d[p]; p += 1; x = 0
            for _ in range(pk):
                x += d[p]; c = struct.unpack_from('<b', d, p + 1)[0]; p += 2
                if c > 0: px[y * w + x:y * w + x + c] = d[p:p + c]; p += c; x += c
                else: px[y * w + x:y * w + x - c] = bytes([d[p]]) * (-c); p += 1; x += -c
    elif t == 13: px[:] = bytes(w * h)
    elif t == 15:   # BRUN
        p = 0
        for y in range(h):
            p += 1; x = 0
            while x < w:
                c = struct.unpack_from('<b', d, p)[0]; p += 1
                if c > 0: px[y * w + x:y * w + x + c] = bytes([d[p]]) * c; p += 1; x += c
                else: px[y * w + x:y * w + x - c] = d[p:p - c]; p += -c; x += -c
    elif t == 16: px[:] = d[:w * h]


def blocks(b):
    for k, H in enumerate(heads(b)):
        pal = [min(255, x * 4) for x in b[H - 768:H]]
        w, h = struct.unpack_from('<II', b, H)
        px, i = rle(b, H + 8, w * h)
        size, nf = struct.unpack_from('<IH', b, i)
        frames = []
        p = i + 6
        for f in range(nf):
            fs, magic, nc = struct.unpack_from('<IHH', b, p)
            if magic != 0xF1FA: break
            frames.append(b[p + 16:p + fs]); p += fs
        yield k, w, h, pal, px, frames


def play(w, h, pal, px, frames):
    """프레임마다 (px, pal) 를 낸다 (0 = 바탕)"""
    px = bytearray(px); pal = list(pal)
    yield px, pal
    for fr in frames:
        p = 0
        while p + 6 <= len(fr):
            cs, ct = struct.unpack_from('<IH', fr, p)
            if cs < 6: break
            try: chunk(px, pal, w, h, ct, fr[p + 6:p + cs])
            except (IndexError, struct.error): pass
            p += cs
        yield px, pal


if __name__ == '__main__':
    b = open(sys.argv[1], 'rb').read()
    od = sys.argv[2]; os.makedirs(od, exist_ok=True)
    every = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    for k, w, h, pal, px, frames in blocks(b):
        n = len(frames)
        for f, (cur, cp) in enumerate(play(w, h, pal, px, frames)):
            if f in (0, n) or (every and f % every == 0):
                im = Image.frombytes('P', (w, h), bytes(cur)); im.putpalette(cp)
                im.convert('RGB').save(os.path.join(od, f'{k:03}_{f:03}.png'))
        print(k, w, h, 'frames', n)
