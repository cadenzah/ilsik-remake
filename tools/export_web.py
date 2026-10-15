"""build/ 추출물과 original/ 데이터에서 웹용 자원을 public/assets/ 로 만든다.
선행: tools/extract_all.py. 출력 구조는 .claude/docs/assets.md 의 '웹 자원' 절 참고."""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import stage, units, tables, bad, script, cond, font

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
    export_worldmap()


# 원작 장소 이름 (ECLIPSE.SCR 0~42 이름표 그림을 옮겨 적음, 칸 n = n+1장). 개선판 장 카드 장소와 같다
PLACES = ['페얼촌', '바하라무성', '지하 신전', '아츠리스 동굴', '아츠리스 동굴 안', '상지스 광장', '상지스 광장 안', '고신전', '바하라무성',
          '혼탁한 호수', '빙설암', '암흑동굴', '고신전 이층', '제신주랑', '북쪽의 다리', '하스가나 사막', '유하 마을 밖', '망혼림', '염룡곡',
          '신카루스 항구 밖', '카루스만', '신카루스 항구 안', '마카만', '고해', '해적섬', '성전기사당', '봉화대', '배신자의 묘', '배신자의 묘 안',
          '악령의 언덕', '사형수의 섬', '색령대전', '거인리', '명신의 숲', '명신의 숲 안', '사바카 성 밖', '봉인 신전', '사바카 성 안', '수련회랑',
          '수련자의 성', '마석의 탑', '호마신전', '사바카의 궁전']   # 띄어쓰기는 고쳐 씀, 그림 오타(아스가나·사카바성)는 대사 표기로 (formats.md)


def export_worldmap():
    """장 사이 대륙 지도 (원작 0aa2:2120, formats.md "대륙 지도"): worldmap.png = ECLIPSE.SCR 43 (640×480, 「亞摩斯大陸」),
    places.png = 이름표 SCR 0~42 를 세로로 쌓은 시트 (투명 = 255번), data/worldmap.json = 장마다 {name, title (원작 장 제목), x, y (지도 위 좌상단, EXE DS:0x5c0·0x616), w, h, sy (시트 y)}"""
    import exe
    d = mkdir('ui')
    Image.open(os.path.join(IMG, 'ECLIPSE.SCR', '043.png')).convert('RGB').save(os.path.join(d, 'worldmap.png'))
    ims = [rgba(os.path.join(IMG, 'ECLIPSE.SCR', f'{i:03}.png')) for i in range(43)]
    sheet = Image.new('RGBA', (max(im.width for im in ims), sum(im.height for im in ims)), (0, 0, 0, 0))
    raw, ds = bytes(exe.img), exe.DS * 16
    xs, ys = struct.unpack_from('<43H', raw, ds + 0x5c0), struct.unpack_from('<43H', raw, ds + 0x616)
    places, y = [], 0
    for i, im in enumerate(ims):
        sheet.paste(im, (0, y))
        # 원작 장 제목: DS:0x13bd + 15×(장−1), CP949 공백 채움 (formats.md)
        title = raw[ds + 0x13bd + 15 * i: ds + 0x13bd + 15 * i + 15].split(b'\0')[0].decode('cp949').strip()
        places.append({'name': PLACES[i], 'title': title, 'x': xs[i], 'y': ys[i], 'w': im.width, 'h': im.height, 'sy': y})
        y += im.height
    sheet.save(os.path.join(d, 'places.png'))
    json.dump({'places': places}, open(os.path.join(mkdir('data'), 'worldmap.json'), 'w'), ensure_ascii=False, separators=(',', ':'))


def export_camp():
    """정비 화면 (원작 124e:8994, formats.md "정비 화면"). 화면 = 창틀 ECPMAI "tactics" 8조각 + WIN 2 를 (25,12) 에 (DOSBox 로 확정).
    camp-bg 640×480 (창틀 + WIN 2), camp-status = WIN 1 인물기본자료 바탕 330×330 (화면 (25,12)),
    camp-face = BS 1 출전 줄 얼굴 56×48 (11열, 간격 57), camp-mini = BS 2 대기 격자 46×39 (13열, 간격 47), 둘 다 칸 = 유닛 번호 0~28,
    equip = ECLIPSE.EQU 아이콘 182개 48×56 를 13열로 (칸 = 품목 id − 1), camp-por = 초상 96×111 12열 (칸 = por). 팔레트 255 = 투명. camp-x = STA 11 장착 불가 X"""
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
    camp_setting_button(bg).save(os.path.join(d, 'camp-setting.png'))
    button_sprite(bg, 147).save(os.path.join(d, 'camp-quit.png'))   # 개선판: 종료를 한 칸 아래로 옮겨 그린다
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
    rgba(os.path.join(IMG, 'ECLIPSE.STA', '011.png')).save(os.path.join(d, 'camp-x.png'))   # STA 11 = 장착 불가 빨간 X (46×39)


def button_sprite(bg, y, face=None):
    """정비 화면 명령 버튼 (화면 (568,y) 46×25) 을 바깥 테 안쪽만 남겨 RGBA 로. face = 버튼 면을 바꾼 그림 (없으면 원래 그대로)"""
    EDGE = ((0, 0, 0), (0, 24, 12))
    src = bg.crop((568, y, 614, y + 25)); s = src.load(); p = (face or src).load()
    out = Image.new('RGBA', src.size); o = out.load()
    for yy in range(src.height):
        xs = [x for x in range(src.width) if s[x, yy] in EDGE]
        for x in range(xs[0], xs[-1] + 1) if xs else ():
            o[x, yy] = p[x, yy] + (255,)
    return out


def camp_setting_button(bg):
    """개선판 원작 모양 정비 화면의 「설정」 버튼 46×25 (웹 보탬). 음악 다음 = 원래 종료 칸 (화면 (568,147)), 종료는 한 칸 아래 (568,182) 로 (camp-quit).
    원작 「음악」 버튼 (화면 (568,112)) 의 글자·그림자를 지워 줄마다 띠 색으로 메우고, 원작 글꼴 (FULLSOFT) 로 '설정' 을
    흰 1px 획 + 오른쪽 검은 그림자 1px (원작 버튼 글자 규칙) 으로 얹는다. 자리 = 원작 버튼 글자 여백에 맞춤
    (안쪽 면 6~40열 중 글자 8~38열·그림자 39 이하, 세로 6~19행). 버튼 바깥 테 밖은 투명"""
    from collections import Counter
    W, K = (252, 252, 252), (0, 0, 0)
    b = bg.crop((568, 112, 614, 137)); p = b.load()
    for y in range(4, 22):
        c = Counter(p[x, y] for x in range(6, 40) if p[x, y] not in (W, K)).most_common(1)[0][0]
        for x in range(5, 41):
            if p[x, y] in (W, K): p[x, y] = c
    pts = set()
    for i, ch in enumerate('설정'):
        w, rows = font.glyph(ch)
        for r, bits in enumerate(rows):
            for c in range(w):
                if bits >> (w - 1 - c) & 1: pts.add((7 + i * 17 + c, 6 + r))
    for x, y in pts: p[x, y] = W
    for x, y in pts:
        if (x + 1, y) not in pts: p[x + 1, y] = K
    return button_sprite(bg, 112, b)


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


def export_magic_fx():
    """마법 이펙트 (ECLIPSE.MAG, 124e:0f31 적재·20ec:5c0f 재생). 시트 0~9 = 11열 × 4줄 중 42프레임, 시트 10 = 24프레임 (프레임 420~443),
    칸 56×96 간격 57×97 (테두리 1). 마법 id 의 프레임 = id×6 ~ id×6+5. 444프레임을 24열 아틀라스 한 장으로 (칸 = 프레임 번호). 팔레트 255 = 투명"""
    d = mkdir('ui')
    W, H, COLS = 56, 96, 24
    out = Image.new('RGBA', (W * COLS, H * ((444 + COLS - 1) // COLS)))
    for f in range(444):
        s, k = divmod(f, 42)
        r, c = divmod(k, 11)
        sheet = rgba(os.path.join(IMG, 'ECLIPSE.MAG', f'{s:03d}.png'))
        out.paste(sheet.crop((1 + c * 57, 1 + r * 97, 1 + c * 57 + W, 1 + r * 97 + H)), ((f % COLS) * W, (f // COLS) * H))
    out.save(os.path.join(d, 'magic-fx.png'), optimize=True)


def export_battle_ui():
    """전투 화면 UI 조각 묶음 (ux-proposal.md, core/frame.ts·win.ts). battle-ui.png 한 장 + battle-ui.json {이름: [x, y, w, h]}.
    FRTWND 9조각 = 이름.0 바탕 .1 위 .2 왼위 .3 오른위 .4 왼아래 .5 오른아래 .6 아래 .7 왼쪽 .8 오른쪽:
    mw = ECPMAI "mapwin" 전투 창틀, comma = 명령·확인창, speak = 대화창, basic = 인물기본자료, level, magic.
    btn.0~5 = ECPBUT 0005 글자 버튼 (0 왼 1 오른 2 가운데 = 보통, 3·4·5 = 눌림), icon.N.S = ECPBUT 000N 아이콘 (상태 0 1 3 4),
    sta.N = ECLIPSE.STA (0 커서 1 차례 괄호 2 대상 틀 3 십자 5 디더 12 Level Up 13·14·15 진영), oth.N = ECLIPSE.OTH (3 Level Up 4 GO!! 5 양피지)"""
    import frtwnd
    pal = frtwnd.palette(os.path.join(ROOT, 'original', 'ECLIPSE.WIN'), 2)
    parts = []
    for f, want, pre in (('ECPMAI', 'mapwin', 'mw'), ('ECPCOM', 'comma', 'comma'), ('ECPSPE', 'speak', 'speak'),
                         ('ECPBAS', 'basic', 'basic'), ('ECPLEV', 'level', 'level'), ('ECPMAG', 'magic', 'magic')):
        for _, n, k, w, h, px in frtwnd.entries(open(os.path.join(ROOT, 'original', f + '.ECP'), 'rb').read()):
            if n == want:
                parts.append((f'{pre}.{k >> 8}', frtwnd.image(w, h, px, pal).convert('RGBA')))
    for _, n, k, w, h, px in frtwnd.entries(open(os.path.join(ROOT, 'original', 'ECPBUT.ECP'), 'rb').read()):
        im = frtwnd.image(w, h, px, pal).convert('RGBA')
        parts.append((f'btn.{k >> 8}' if n == '0005' else f'icon.{int(n)}.{k >> 8}', im))
    for i in (0, 1, 2, 3, 5, 12, 13, 14, 15):
        parts.append((f'sta.{i}', rgba(os.path.join(IMG, 'ECLIPSE.STA', f'{i:03d}.png'))))
    for i in (3, 4, 5):
        parts.append((f'oth.{i}', rgba(os.path.join(IMG, 'ECLIPSE.OTH', f'{i:03d}.png'))))
    # 선반 배치 (높이 순), 너비 1024
    parts.sort(key=lambda p: -p[1].height)
    rects, x, y, row, W = {}, 0, 0, 0, 1024
    for name, im in parts:
        if x + im.width > W:
            x, y, row = 0, y + row + 1, 0
        rects[name] = [x, y, im.width, im.height]
        x += im.width + 1
        row = max(row, im.height)
    sheet = Image.new('RGBA', (W, y + row))
    for name, im in parts:
        sheet.paste(im, tuple(rects[name][:2]))
    d = mkdir('ui')
    sheet.save(os.path.join(d, 'battle-ui.png'))
    json.dump(rects, open(os.path.join(d, 'battle-ui.json'), 'w'), separators=(',', ':'))


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
          | {'def': u['def_'], 'equip': [e[1] for e in u['equip']], 'toolKind': u['equip'][2][0], 'canMagic': u['can_magic'], 'moveKind': u['move_kind']}
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
    elif sys.argv[1:] == ['magic-fx']:
        export_magic_fx()
    elif sys.argv[1:] == ['battle-ui']:
        export_battle_ui()
    elif sys.argv[1:] == ['font']:
        import font; font.export()
    else:
        import font
        export_stages(); export_units(); export_portraits(); export_ui(); export_status_icons(); export_magic_fx(); export_battle_ui(); export_data(); font.export()
    print('ok')
