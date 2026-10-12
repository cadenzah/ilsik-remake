"""유닛 종류 표 (ECLIPSE1.PAD) 파서. 필드 오프셋은 이름 시작 기준, 추정치는 formats.md 참고."""
import os, struct, sys
ROOT = os.path.join(os.path.dirname(__file__), '..')
R = 118
# 이름 기준 +N = 런타임 유닛 구조체 +N+6. 능력치 이름은 EXE 장비 능력치 표 (formats.md)
# cls = 종족 (예전 이름 유지, race 와 같은 값). 아래 race~exp 는 인물 상태창 124e:7c18 이 그리는 필드 (formats.md)
F = dict(id=10, por=12, cls=16, lv=24, hp=26, atk=30, def_=34, spi=42, agi=46, mov=50,
         race=16, sex=18, job=22, fatigue=52, exp=54, move_kind=56, rank=60)
# 상태창 글자 표: EXE DS 의 far 포인터 배열 (DS 오프셋, 개수). 값 = 위 필드로 그대로 색인
LABELS = dict(race=(0x1076, 14), sex=(0x10b2, 3), job=(0x10c2, 21), move_kind=(0x111a, 5), rank=(0x1132, 7))


def labels(exe='ECP.EXE'):
    """ECP.EXE 에서 상태창 문자열 표 (종족·성별·직업·이동방식·부하상태) 를 CP949 로 읽는다."""
    raw = open(os.path.join(ROOT, 'original', exe), 'rb').read()
    img = raw[struct.unpack_from('<H', raw, 8)[0] * 16:]
    ds = 0x573a * 16
    out = {}
    for k, (off, n) in LABELS.items():
        ptrs = [struct.unpack_from('<HH', img, ds + off + 4 * i) for i in range(n)]
        out[k] = [img[s * 16 + o: img.index(b'\0', s * 16 + o)].decode('cp949').strip() for o, s in ptrs]
    return out


def load(path='ECLIPSE1.PAD'):
    d = open(os.path.join(ROOT, 'original', path), 'rb').read()
    out = []
    for i in range(struct.unpack_from('<H', d, 0)[0]):
        b = 8 + i * R
        u = {k: struct.unpack_from('<H', d, b + o)[0] for k, o in F.items()}
        u['name'] = d[b:b + 10].decode('cp949', 'replace').strip()
        g = lambda o: struct.unpack_from('<H', d, b + o)[0]
        # 장비 슬롯 3개 = (EAD 세부 종류, EAD id), id 0 = 없음
        u['equip'] = [(g(o), g(o + 2)) for o in (78, 82, 86)]
        u['can_magic'] = g(90)
        u['magic'] = [g(94 + 2 * k) for k in range(g(92))]  # MAD id, 최대 8
        u['raw'] = d[b + 10:b + R - 6]
        out.append(u)
    return out


if __name__ == '__main__':
    for u in load(*sys.argv[1:]):
        print(f"{u['id']:3d} {u['name']:6s} por{u['por']:3d} cls{u['cls']:3d} lv{u['lv']:3d} hp{u['hp']:4d} atk{u['atk']:3d} def{u['def_']:3d} spi{u['spi']:3d} agi{u['agi']:3d} mov{u['mov']:2d} eq{[e[1] for e in u['equip']]} mag{u['magic']}")
