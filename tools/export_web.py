"""build/ 추출물과 original/ 데이터에서 웹용 자원을 public/assets/ 로 만든다.
선행: tools/extract_all.py. 출력 구조는 .claude/docs/assets.md 의 '웹 자원' 절 참고."""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import stage, units, tables, bad, script, cond

ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'build', 'img')
OUT = os.path.join(ROOT, 'public', 'assets')
TRANSPARENT = 255
TW, TH = 56, 48


def rgba(path):
    """팔레트 255번을 투명으로."""
    im = Image.open(path)
    a = im.point(lambda i: 0 if i == TRANSPARENT else 255, 'L')
    im = im.convert('RGBA')
    im.putalpha(a)
    return im


def mkdir(*p):
    d = os.path.join(OUT, *p)
    os.makedirs(d, exist_ok=True)
    return d


def export_stages():
    d = mkdir('stages')
    for n in range(1, 44):
        s = stage.load(n)
        tiles = stage.tile_images(n)
        cols = 11
        atlas = Image.new('RGB', (cols * TW, ((len(tiles) + cols - 1) // cols) * TH))
        for i, t in enumerate(tiles):
            atlas.paste(t, ((i % cols) * TW, (i // cols) * TH))
        atlas.save(os.path.join(d, f'{n:02d}.png'))
        json.dump({k: s[k] for k in ('w', 'h', 'tiles', 'layer2', 'layer3')} | {'atlasCols': cols},
                  open(os.path.join(d, f'{n:02d}.json'), 'w'), separators=(',', ':'))


def export_units():
    """유닛 i 의 이동 프레임 13장을 가로 한 줄(56×48 × 13)로."""
    d = mkdir('units')
    for i in range(104):
        src = os.path.join(IMG, f'ECP{i // 10:02d}.MOV', f'{i % 10:03d}.png')
        im = rgba(src)
        strip = Image.new('RGBA', (13 * TW, TH))
        for f in range(13):
            r, c = divmod(f, 9)
            x, y = 1 + c * (TW + 1), 1 + r * (TH + 1)
            strip.paste(im.crop((x, y, x + TW, y + TH)), (f * TW, 0))
        strip.save(os.path.join(d, f'{i:03d}.png'))


def export_portraits():
    d = mkdir('portraits')
    for f in sorted(os.listdir(os.path.join(IMG, 'ECLIPSE.POR'))):
        Image.open(os.path.join(IMG, 'ECLIPSE.POR', f)).convert('RGB').save(os.path.join(d, f))


def export_ui():
    """타이틀·메인 메뉴 (원작 124e:e404 재현용, formats.md "메인 메뉴").
    mark0 돌판 로고, mark1 두루마리 노인 (메뉴 배경), staff/publish 제작진·발행 화면 (ECPPLANE 0·1),
    menu-frame = MAIN.ECP face 9조각을 합친 172×199 (ECPMARK 1번 팔레트), btn-new/btn-load = 버튼 120×48 (위 보통, 아래 강조),
    thunder.wav = ECPMARK.FVT 1번 (로고 번쩍일 때)"""
    import shutil, frtwnd
    d = mkdir('ui')
    for name, src in (('mark0', 'ECPMARK.MAR/000'), ('mark1', 'ECPMARK.MAR/001'), ('staff', 'ECPPLANE.ECP/000'), ('publish', 'ECPPLANE.ECP/001')):
        Image.open(os.path.join(IMG, src + '.png')).convert('RGB').save(os.path.join(d, name + '.png'))
    pal = frtwnd.palette(os.path.join(ROOT, 'original', 'ECPMARK.MAR'), 1)
    E = {(n, k): frtwnd.image(w, h, px, pal).convert('RGB')
         for _, n, k, w, h, px in frtwnd.entries(open(os.path.join(ROOT, 'original', 'MAIN.ECP'), 'rb').read())}
    f = lambda k: E[('face', k)]
    fr = Image.new('RGB', (172, 199))
    for k, xy in ((0x203, (0, 0)), (0x103, (26, 0)), (0x303, (146, 0)), (0x703, (0, 60)), (0x003, (26, 60)),
                  (0x803, (146, 60)), (0x403, (0, 173)), (0x603, (26, 173)), (0x503, (146, 173))):
        fr.paste(f(k), xy)
    fr.save(os.path.join(d, 'menu-frame.png'))
    for b, name in (('b2', 'new'), ('b1', 'load'), ('b3', 'quit')):
        im = Image.new('RGB', (120, 48))
        for k, xy in ((0x000, (0, 0)), (0x100, (60, 0)), (0x300, (0, 24)), (0x400, (60, 24))):
            im.paste(E[(b, k)], xy)
        im.save(os.path.join(d, f'btn-{name}.png'))
    shutil.copy(os.path.join(ROOT, 'build', 'snd', 'ECPMARK.FVT', '001.wav'), os.path.join(d, 'thunder.wav'))
    for old in ('title.png',):
        if os.path.exists(os.path.join(d, old)): os.remove(os.path.join(d, old))


def export_data():
    d = mkdir('data')
    fnt = open(os.path.join(ROOT, 'original', 'ECLIPSE.FNT'), 'rb').read()
    lines, p = [], 0
    while p + 2 <= len(fnt):
        n = struct.unpack_from('<H', fnt, p)[0]
        lines.append(fnt[p + 2:p + 2 + n].decode('cp949', 'replace'))
        p += 2 + n
    json.dump(lines, open(os.path.join(d, 'dialogue.json'), 'w'), ensure_ascii=False, indent=0)
    # 능력치는 PAD 기본값 (장비 보정 전). equip = [무기, 방어구, 도구] EAD id (0 = 없음), magic = MAD id 목록
    us = [{k: u[k] for k in ('id', 'name', 'por', 'cls', 'lv', 'hp', 'atk', 'spi', 'agi', 'mov', 'magic')}
          | {'def': u['def_'], 'equip': [e[1] for e in u['equip']], 'canMagic': u['can_magic']}
          for u in units.load()]
    json.dump(us, open(os.path.join(d, 'units.json'), 'w'), ensure_ascii=False, indent=0)
    json.dump(tables.load_magic(), open(os.path.join(d, 'magic.json'), 'w'), ensure_ascii=False, indent=0)
    # stat/stat2 = [능력치 번호, 보정량], 번호 의미는 tables.STATS (9~16 = 1~8 감소)
    items = [{k: it[k] for k in ('id', 'cat', 'sub', 'name', 'f1', 'f2', 'f3')}
             | {'stat': [it['kind'], it['value']], 'stat2': [it['x1'], it['x2']]}
             for it in tables.load_items()]
    json.dump(items, open(os.path.join(d, 'items.json'), 'w'), ensure_ascii=False, indent=0)
    export_battles(d)
    # 대화 장면·전투 전후 흐름 (tools/script.py). scenes["phase:scene"] = [[인물, 줄, 분기]], 인물 -1 = 초상화 없음
    json.dump(script.export(), open(os.path.join(d, 'scenes.json'), 'w'), ensure_ascii=False, separators=(',', ':'))


def export_battles(d):
    # 부대 순서 = [0 일행, (npc 있으면) 1 npc, 이후 groups]. 상태(npcState·active) 4 = 처음엔 숨김
    # route[i] = i번째 전투의 [루트0, 루트1, 루트2] 스테이지 번호 (i=1~29). records["s-r"] = 배치 (x, y 칸 좌표)
    R, S, RT = bad.load(), bad.lml_sizes(), bad.route_table()
    recs = {}
    for s, r in sorted({(s, j) for row in RT[1:] for j, s in enumerate(row)}):
        p = bad.parse(R[(s - 1) * 3 + r]); W = S[s - 1][0]
        xy = lambda ps: [bad.to_xy(x, W) for x in ps]
        recs[f'{s}-{r}'] = {
            'slots': xy(p['slots']),
            'npc': [{'type': t, 'at': a} for t, a in zip(p['npc']['types'], xy(p['npc']['pos']))],
            'npcState': p['npc']['flag'],
            'groups': [{'active': g['active'], 'units': [{'type': t, 'at': a} for t, a in zip(g['types'], xy(g['pos']))]}
                       for g in p['groups']],
            'treasure': [{'item': t['item'], 'at': bad.to_xy(t['pos'], W)} for t in p['treasure']],
            'reward': p['reward']}
    # cond[stage] = 장별 승패 규칙 (tools/cond.py COND). reach 는 [x, y] 로 바꿔 둔다
    cnd = {s: [{**c, 'if': {'reach': bad.to_xy(c['if']['reach'], S[s - 1][0])}} if 'reach' in c['if'] else c for c in rules]
           for s, rules in cond.COND.items()}
    # turn[stage] = 턴 시작 이벤트 (tools/cond.py TURN). area 칸은 [x, y] 로
    trn = {s: [{'area': [e['area'][0], [bad.to_xy(p, S[s - 1][0]) for p in e['area'][1]]]} if 'area' in e else e for e in evs]
           for s, evs in cond.TURN.items()}
    json.dump({'route': RT, 'records': recs, 'cond': cnd, 'turn': trn}, open(os.path.join(d, 'battles.json'), 'w'),
              ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    if sys.argv[1:] == ['data']:
        export_data()
    elif sys.argv[1:] == ['ui']:
        export_ui()
    else:
        export_stages(); export_units(); export_portraits(); export_ui(); export_data()
    print('ok')
