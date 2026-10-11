"""ECLIPSE.BAD 스테이지 배치 데이터 (300B × 129, 앞 252B 사용).
레코드 = (스테이지-1)*3 + 루트(0~2). 전투 순서표는 EXE DS:0x204a (30×3 바이트).
사용: python tools/bad.py [check|dump N|json]"""
import struct, sys, json

def load():
    d = open('original/ECLIPSE.BAD', 'rb').read()
    return [struct.unpack_from('<150H', d, i*300) for i in range(len(d)//300)]

def lml_sizes():
    d = open('original/ECLIPSE.LML', 'rb').read()
    return [struct.unpack_from('<2H', d, i*2000+12) for i in range(43)]

def lml_layer2(stage):
    d = open('original/ECLIPSE.LML', 'rb').read(); b = (stage-1)*2000
    W, H = struct.unpack_from('<2H', d, b+12)
    return d[b+100+W*H: b+100+2*W*H]

def route_table():
    raw = open('original/ECP.EXE', 'rb').read()
    hdr = struct.unpack('<14H', raw[:28]); at = hdr[4]*16 + 0x573a*16 + 0x204a
    t = raw[at: at+90]
    return [list(t[i*3:i*3+3]) for i in range(30)]

def parse(w):
    def lst(n, a): return [w[a+i] for i in range(n)]
    slots = [x for x in w[11:19] if x]
    r = {'stage': w[0], 'slots': slots,
         'npc': {'types': lst(w[19], 20), 'pos': lst(w[19], 27), 'flag': w[33]},
         'groups': [], 'treasure': [], 'reward': []}
    for k in range(w[34]):
        n = w[35+9*k]
        r['groups'].append({'types': lst(n, 36+9*k), 'pos': lst(n, 72+9*k), 'active': w[107+k]})
    t = w[107:]
    r['treasure'] = [{'item': t[5+i], 'pos': t[10+i]} for i in range(t[4])]
    r['reward'] = lst(t[14], 122)
    r['unknown'] = {k: w[k] for k in list(range(1, 11)) + [71, 80, 89, 98] if w[k]}
    return r

def to_xy(p, W): return [p % W, p // W]

if __name__ == '__main__':
    R = load(); S = lml_sizes(); RT = route_table()
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    used = sorted({(s, j) for row in RT[1:] for j, s in enumerate(row)})
    if cmd == 'dump':
        print(json.dumps(parse(R[int(sys.argv[2])]), ensure_ascii=False))
    elif cmd == 'check':
        from collections import Counter
        bad = 0; terr = Counter(); maxn = Counter()
        for s, j in used:
            p = parse(R[(s-1)*3+j]); W, H = S[s-1]; L2 = lml_layer2(s)
            if p['stage'] != s: print('stage mismatch', s, j, p['stage'])
            allpos = p['slots'] + p['npc']['pos'] + [x for g in p['groups'] for x in g['pos']] + [t['pos'] for t in p['treasure']]
            for x in allpos:
                if x >= W*H: bad += 1
                else: terr[L2[x]] += 1
            if p['unknown']: print('unknown', s, j, p['unknown'])
        print('used', len(used), 'out-of-map', bad, 'terrain at positions', dict(terr))
