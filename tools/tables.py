"""마법 표(ECLIPSE.MAD)·장비 표(ECLIPSE.EAD) 파서. 필드 의미는 .claude/docs/formats.md 참고.
사용: tables.py [magic|items] — 표 출력. export_web.py 에서 load_* 사용."""
import os, struct, sys
ROOT = os.path.join(os.path.dirname(__file__), '..')
SCHOOLS = ['빛', '어둠', '바람', '물', '불', '땅', '소환', '노래', '기원']
# 장비 (kind,value)·(x1,x2) 의 능력치 번호 = EXE DS:0x1194 이름표, 9~16 = 1~8 감소 (formats.md)
STATS = ['없음', '생명', '정신', '역량', '방어', '마법', '이동', '민첩', '체력']
# 마법 효과 번호 = EXE DS:0x1266 이름표 (MAD +0x12 로 색인)
EFFECTS = ['생명회복', '공격증가', '방어증가', '민첩증가', '정신증가', '해독', '혼수해제', '생명상해',
           '공격감소', '방어감소', '민첩감소', '정신감소', '중독', '혼수', '상태회복', '피로증가']


def stat_name(n):
    return STATS[n] if n <= 8 else STATS[n - 8] + '−'


def _read(name):
    return open(os.path.join(ROOT, 'original', name), 'rb').read()


def load_magic():
    d = _read('ECLIPSE.MAD')
    out = []
    for i in range(struct.unpack_from('<H', d, 0)[0]):
        r = d[2 + i * 24:2 + (i + 1) * 24]
        school, = struct.unpack_from('<H', r, 0)
        # fatigue = 시전 시 유닛 피로(+0x3a)에 더하는 값. 피로+fatigue ≤ 90 이어야 시전 (MP 아님)
        id_, rng, area, effect, power, fatigue = struct.unpack_from('<6H', r, 12)
        out.append(dict(id=id_, school=school, name=r[2:12].decode('cp949', 'replace').strip(),
                        range=rng, area=area, effect=effect, power=power, fatigue=fatigue))
    return out


def load_items():
    d = _read('ECLIPSE.EAD')
    out = []
    for i in range(struct.unpack_from('<H', d, 0)[0]):
        r = d[2 + i * 30:2 + (i + 1) * 30]
        cat, sub = struct.unpack_from('<2H', r, 0)
        f = struct.unpack_from('<8H', r, 14)
        out.append(dict(id=f[0], cat=cat, sub=sub, name=r[4:14].decode('cp949', 'replace').strip(),
                        f1=f[1], f2=f[2], f3=f[3], kind=f[4], value=f[5], x1=f[6], x2=f[7]))
    return out


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'magic'
    for m in (load_magic() if which == 'magic' else load_items()):
        if which == 'magic': m['effect'] = EFFECTS[m['effect']]
        else: m['kind'], m['x1'] = stat_name(m['kind']), stat_name(m['x1'])
        print(m)
