"""마법 표(ECLIPSE.MAD)·장비 표(ECLIPSE.EAD) 파서. 필드 의미는 .claude/docs/formats.md 참고.
사용: tables.py [magic|items] — 표 출력. export_web.py 에서 load_* 사용."""
import os, struct, sys
ROOT = os.path.join(os.path.dirname(__file__), '..')
SCHOOLS = ['빛', '어둠', '바람', '물', '불', '땅', '소환', '노래', '기원']
# 장비 (kind,value)·(x1,x2) 의 능력치 번호. 이름 기준 추정, 5·6·8~12 미상
STATS = {1: 'HP', 2: 'MP', 3: '공격', 4: '방어', 7: '민첩'}


def _read(name):
    return open(os.path.join(ROOT, 'original', name), 'rb').read()


def load_magic():
    d = _read('ECLIPSE.MAD')
    out = []
    for i in range(struct.unpack_from('<H', d, 0)[0]):
        r = d[2 + i * 24:2 + (i + 1) * 24]
        school, = struct.unpack_from('<H', r, 0)
        id_, rng, area, effect, power, mp = struct.unpack_from('<6H', r, 12)
        out.append(dict(id=id_, school=school, name=r[2:12].decode('cp949', 'replace').strip(),
                        range=rng, area=area, effect=effect, power=power, mp=mp))
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
        print(m)
