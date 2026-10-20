"""ECLIPSE.FMT 배경음악 묶음 (2026-10-17, formats.md "배경음악").
묶음 = "FMT" + u16 곡 수 (50) + 곡마다 ("ECLIPSE\\0EC" 10B + u32 크기 + CMF 본문). 원작 불러오기 3716:0325(파일, 번호) 가 앞 곡들을 건너뛰며 찾는다.
CMF (Creative Music File 1.1) = 머리 (악기 블록·음악 블록 위치, 초당 틱) + 16B 악기 (OPL2 연산자 레지스터) + MIDI 꼴 사건열.
사용: python tools/fmt.py [list | dump N [n]]"""
import hashlib, os, struct, sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
PATH = os.path.join(ROOT, 'original', 'ECLIPSE.FMT')


def songs(b=None):
    """[CMF 바이트] × 50"""
    b = b or open(PATH, 'rb').read()
    assert b[:3] == b'FMT'
    n = struct.unpack_from('<H', b, 3)[0]
    p, out = 5, []
    for _ in range(n):
        assert b[p:p + 10] == b'ECLIPSE\0EC', p
        sz = struct.unpack_from('<I', b, p + 10)[0]
        out.append(b[p + 14:p + 14 + sz]); p += 14 + sz
    return out


def header(c):
    assert c[:4] == b'CTMF'
    ver, ins, mus, tpq, tps, tit, com, rem = struct.unpack_from('<8H', c, 4)
    nins, tempo = struct.unpack_from('<HH', c, 36) if ver >= 0x101 else (c[36], struct.unpack_from('<H', c, 37)[0])
    return dict(ver=ver, ins=ins, mus=mus, tpq=tpq, tps=tps, nins=nins, tempo=tempo, used=list(c[20:36]))


def events(c):
    """(틱, 상태, 데이터 바이트들) — 연속 상태 풀어서. FF 2F 에서 끝"""
    h = header(c); p = h['mus']; t = 0; st = 0
    def vlq():
        nonlocal p
        v = 0
        while True:
            x = c[p]; p += 1; v = (v << 7) | (x & 0x7f)
            if x < 0x80: return v
    while p < len(c):
        t += vlq()
        if c[p] & 0x80: st = c[p]; p += 1
        hi = st & 0xf0
        if st == 0xff:
            ty = c[p]; p += 1; ln = vlq(); yield t, st, (ty,) + tuple(c[p:p + ln]); p += ln
            if ty == 0x2f: return
        elif st in (0xf0, 0xf7):
            ln = vlq(); p += ln
        else:
            k = 1 if hi in (0xc0, 0xd0) else 2
            yield t, st, tuple(c[p:p + k]); p += k


def summary(k, c):
    h = header(c)
    ev = list(events(c))
    ch = sorted({s & 15 for _, s, _ in ev if s < 0xf0})
    ctl = sorted({d[0] for _, s, d in ev if s & 0xf0 == 0xb0})
    rhy = any(s & 0xf0 == 0xb0 and d[0] == 0x67 and d[1] for _, s, d in ev)
    notes = sum(1 for _, s, d in ev if s & 0xf0 == 0x90 and d[1])
    sec = ev[-1][0] / h['tps'] if ev else 0
    return f"{k:2} {len(c):6}B ins {h['nins']:2} tps {h['tps']:3} {sec:6.1f}s notes {notes:5} ch {ch} ctl {[hex(x) for x in ctl]}{' 리듬' if rhy else ''} {hashlib.md5(c).hexdigest()[:6]}"


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    ss = songs()
    if cmd == 'list':
        for k, c in enumerate(ss): print(summary(k, c))
    elif cmd == 'dump':
        k = int(sys.argv[2]); n = int(sys.argv[3]) if len(sys.argv) > 3 else 40
        print(header(ss[k]))
        for i, e in enumerate(events(ss[k])):
            if i >= n: break
            print(e)
