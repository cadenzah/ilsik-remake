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
    menu-frame = MAIN.ECP face 9조각을 합친 172×199 (ECPMARK 1번 팔레트). 버튼 그림(b1~b3)은 저해상도라 쓰지 않고 글자로 (사용자 결정),
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
    shutil.copy(os.path.join(ROOT, 'build', 'snd', 'ECPMARK.FVT', '001.wav'), os.path.join(d, 'thunder.wav'))
    for old in ('title.png', 'btn-new.png', 'btn-load.png', 'btn-quit.png'):
        if os.path.exists(os.path.join(d, old)): os.remove(os.path.join(d, old))
    export_camp()


def export_camp():
    """정비 화면 (원작 124e:8994, formats.md "정비 화면"). 화면 = 창틀 ECPMAI "tactics" 8조각 + WIN 2 를 (25,12) 에 (DOSBox 로 확정).
    camp-bg 640×480 (창틀 + WIN 2), camp-status = WIN 1 인물기본자료 바탕 330×330 (화면 (25,12)),
    camp-face = BS 1 출전 줄 얼굴 56×48 (11열, 간격 57), camp-mini = BS 2 대기 격자 46×39 (13열, 간격 47), 둘 다 칸 = 유닛 번호 0~28,
    equip = ECLIPSE.EQU 아이콘 182개 48×56 를 13열로 (칸 = 품목 id − 1), camp-por = 초상 96×111 12열 (칸 = por). 팔레트 255 = 투명"""
    import frtwnd
    d = mkdir('ui')
    pal = frtwnd.palette(os.path.join(ROOT, 'original', 'ECLIPSE.WIN'), 2)
    E = {k: frtwnd.image(w, h, px, pal).convert('RGB')
         for _, n, k, w, h, px in frtwnd.entries(open(os.path.join(ROOT, 'original', 'ECPMAI.ECP'), 'rb').read()) if n == 'tactics'}
    bg = Image.new('RGB', (640, 480))
    for k, xy in ((0x203, (0, 0)), (0x103, (25, 0)), (0x303, (615, 0)), (0x703, (0, 12)),
                  (0x803, (615, 12)), (0x403, (0, 468)), (0x603, (25, 468)), (0x503, (615, 468))):
        bg.paste(E[k], xy)
    bg.paste(Image.open(os.path.join(IMG, 'ECLIPSE.WIN', '002.png')).convert('RGB'), (25, 12))
    bg.save(os.path.join(d, 'camp-bg.png'))
    Image.open(os.path.join(IMG, 'ECLIPSE.WIN', '001.png')).convert('RGB').save(os.path.join(d, 'camp-status.png'))
    for name, src, (w, h), cols in (('camp-face', '001', (56, 48), 11), ('camp-mini', '002', (46, 39), 13)):
        sheet = rgba(os.path.join(IMG, 'ECLIPSE.BS', src + '.png'))
        out = Image.new('RGBA', (w * 29, h))
        for i in range(29):
            r, c = divmod(i, cols)
            out.paste(sheet.crop((1 + c * (w + 1), 1 + r * (h + 1), 1 + c * (w + 1) + w, 1 + r * (h + 1) + h)), (i * w, 0))
        out.save(os.path.join(d, name + '.png'))
    eq = sorted(os.listdir(os.path.join(IMG, 'ECLIPSE.EQU')))
    atlas = Image.new('RGBA', (13 * 48, ((len(eq) + 12) // 13) * 56))
    for i, f in enumerate(eq):
        atlas.paste(rgba(os.path.join(IMG, 'ECLIPSE.EQU', f)), ((i % 13) * 48, (i // 13) * 56))
    atlas.save(os.path.join(d, 'equip.png'))
    # 초상 (ECLIPSE.POR 96×111) 을 투명 배경으로 12열 — 원작은 255 번 자리에 WIN 1 바탕이 보인다
    por = sorted(os.listdir(os.path.join(IMG, 'ECLIPSE.POR')))
    atlas = Image.new('RGBA', (12 * 96, ((len(por) + 11) // 12) * 111))
    for i, f in enumerate(por):
        atlas.paste(rgba(os.path.join(IMG, 'ECLIPSE.POR', f)), ((i % 12) * 96, (i // 12) * 111))
    atlas.save(os.path.join(d, 'camp-por.png'))


def export_status_icons():
    """인물 상태창 아이콘 (124e:7c18, formats.md "정비 화면").
    magic-icons = ECLIPSE.MAR 9번 시트 (19열 × 4줄, 32×40, 간격 33) 를 한 줄로 32×40 × 74, 칸 = MAD id (−1 없음).
    status-icons = ECLIPSE.OTH 0 (혼수 추정, ZZ) · 1 (중독 추정, 해골) 13×12 를 가로로. 팔레트 255 = 투명"""
    d = mkdir('ui')
    sheet = rgba(os.path.join(IMG, 'ECLIPSE.MAR', '009.png'))
    out = Image.new('RGBA', (32 * 74, 40))
    for i in range(74):
        r, c = divmod(i, 19)
        out.paste(sheet.crop((1 + c * 33, 1 + r * 41, 1 + c * 33 + 32, 1 + r * 41 + 40)), (i * 32, 0))
    out.save(os.path.join(d, 'magic-icons.png'))
    st = Image.new('RGBA', (26, 12))
    for i in range(2):
        st.paste(rgba(os.path.join(IMG, 'ECLIPSE.OTH', f'{i:03d}.png')), (i * 13, 0))
    st.save(os.path.join(d, 'status-icons.png'))


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
    # 상태창 필드 (124e:7c18): race·sex·job·moveKind·rank 는 labels.json 의 같은 이름 표 색인 (rank = 부하상태 "A +" 등),
    # lv = 등급, fatigue = 피로도, exp = 경험치. cls 는 race 와 같은 값 (예전 이름)
    us = [{k: u[k] for k in ('id', 'name', 'por', 'cls', 'lv', 'hp', 'atk', 'spi', 'agi', 'mov', 'magic',
                             'race', 'sex', 'job', 'rank', 'fatigue', 'exp')}
          | {'def': u['def_'], 'equip': [e[1] for e in u['equip']], 'canMagic': u['can_magic'], 'moveKind': u['move_kind']}
          for u in units.load()]
    json.dump(us, open(os.path.join(d, 'units.json'), 'w'), ensure_ascii=False, indent=0)
    lb = units.labels()
    lb['moveKind'] = lb.pop('move_kind')
    json.dump(lb, open(os.path.join(d, 'labels.json'), 'w'), ensure_ascii=False, indent=0)
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
    elif sys.argv[1:] == ['icons']:
        export_status_icons()
    else:
        export_stages(); export_units(); export_portraits(); export_ui(); export_status_icons(); export_data()
    print('ok')
