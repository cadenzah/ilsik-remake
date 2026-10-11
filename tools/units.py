"""유닛 종류 표 (ECLIPSE1.PAD) 파서. 필드 오프셋은 이름 시작 기준, 추정치는 formats.md 참고."""
import os, struct, sys
ROOT = os.path.join(os.path.dirname(__file__), '..')
R = 118
F = dict(id=10, por=12, cls=16, lv=24, hp=26, mp=30, x34=34, atk=42, def_=46, mov=50)


def load(path='ECLIPSE1.PAD'):
    d = open(os.path.join(ROOT, 'original', path), 'rb').read()
    out = []
    for i in range(struct.unpack_from('<H', d, 0)[0]):
        b = 8 + i * R
        u = {k: struct.unpack_from('<H', d, b + o)[0] for k, o in F.items()}
        u['name'] = d[b:b + 10].decode('cp949', 'replace').strip()
        u['raw'] = d[b + 10:b + R - 6]
        out.append(u)
    return out


if __name__ == '__main__':
    for u in load(*sys.argv[1:]):
        print(f"{u['id']:3d} {u['name']:6s} por{u['por']:3d} cls{u['cls']:3d} lv{u['lv']:3d} hp{u['hp']:4d} mp{u['mp']:4d} x{u['x34']:3d} atk{u['atk']:3d} def{u['def_']:3d} mov{u['mov']:2d}")
