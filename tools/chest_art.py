# 보물 상자 도트 생성기 (src/core/chestArt.ts 의 격자를 만든다). 원작 22장 나무 상자·통 팔레트.
# 사용: .venv/bin/python tools/chest_art.py OUT  → OUT.png (원작 타일 위 4배 미리보기) · OUT.txt.  격자 TS: python -c "import sys; sys.path.insert(0,\"tools\"); import chest_art; print(chest_art.ts())"
import sys
from PIL import Image
PAL = {
 'o': '#40181c',  # 외곽선 (원작 짙은 적갈색)
 '1': '#64401c', '2': '#785020', '3': '#a47028', '4': '#d09028', '5': '#dcb870', '6': '#ecd084',  # 나무
 'k': '#3c3c3c', 'm': '#5c5c58', 'n': '#7c7c74', 'g': '#9c9c90', 'h': '#bcbca8',  # 쇠
 'y': '#fcbc50', 'w': '#fcfcd8', 'd': '#202020',  # 금 자물쇠·빛·속
}
W, H = 30, 26
BANDS = (5, 22)  # 쇠띠 왼쪽 x (폭 3)

def blank(): return [['.'] * W for _ in range(H)]

def box(g, open_):
    # 몸통 앞면 rows 12..23, 바닥 24, 외곽 25
    for y in range(11, H):
        for x in range(W):
            g[y][x] = 'o'
    for y in range(12, 24):
        for x in range(1, W - 1):
            t = y - 12
            c = '4' if t < 2 else '3' if t < 8 else '2'
            if y in (16, 20): c = '2'            # 판자 이음
            if y in (17, 21): c = '4' if y == 17 else '3'
            if x == 1: c = '5' if t < 8 else '4'  # 왼쪽 빛
            if x == W - 2: c = '2' if t < 8 else '1'  # 오른쪽 그늘
            g[y][x] = c
    for x in range(1, W - 1): g[24][x] = '1'
    g[24][0] = g[24][W-1] = 'o'
    for y in (11, 25): 
        for x in range(W): g[y][x] = 'o'
    g[25][0] = g[25][W-1] = '.'
    # 쇠띠 (몸통)
    for bx in BANDS:
        for y in range(12, 25):
            g[y][bx] = 'g' if y < 20 else 'n'; g[y][bx+1] = 'n' if y < 22 else 'm'; g[y][bx+2] = 'm' if y < 22 else 'k'
        for ry in (14, 22): g[ry][bx+1] = 'h'

def lid_closed(g):
    # 뚜껑 윗면 rows 0..7 (위에서 본 면, 밝음), 앞 테 rows 8..10
    for y in range(0, 11):
        for x in range(W): g[y][x] = 'o'
    g[0][0] = g[0][1] = g[0][W-1] = g[0][W-2] = '.'
    g[1][0] = g[1][W-1] = '.'
    for y in range(1, 8):
        l = 2 if y == 1 else 1
        for x in range(l, W - l):
            c = '6' if y <= 2 else '5' if y <= 4 else '4'
            if y == 4: c = '4'                    # 판자 이음 (윗면)
            if x == l: c = '6' if y < 5 else '5'
            if x == W - l - 1: c = '4' if y < 5 else '3'
            g[y][x] = c
    for y in range(8, 11):
        for x in range(1, W - 1):
            c = '3' if y == 8 else '2' if y == 9 else '1'
            if x == 1: c = '4' if y == 8 else '3'
            g[y][x] = c
    for bx in BANDS:
        for y in range(1, 11):
            if y < 8: a, b, c = ('h', 'h', 'g') if y <= 3 else ('h', 'g', 'n')
            else: a, b, c = ('g', 'n', 'm') if y == 8 else ('n', 'm', 'k')
            g[y][bx], g[y][bx+1], g[y][bx+2] = a, b, c

def lid_open(g):
    # 젖힌 뚜껑 안쪽 rows 0..7 (어두운 나무), 열린 속 rows 8..10, 앞벽 윗테 row 11
    for y in range(0, 12):
        for x in range(W): g[y][x] = 'o'
    g[0][0] = g[0][1] = g[0][W-1] = g[0][W-2] = '.'
    for y in range(1, 7):
        for x in range(2, W - 2):
            c = '2' if y <= 2 else '1'
            if y == 4: c = '1'
            if x == 2: c = '3'
            g[y][x] = c
    for bx in BANDS:
        for y in range(1, 7):
            g[y][bx], g[y][bx+1], g[y][bx+2] = ('n', 'm', 'k') if y < 4 else ('m', 'k', 'k')
    for y in range(8, 11):
        for x in range(2, W - 2): g[y][x] = 'd' if y > 8 else 'o'
        g[y][1] = '2'; g[y][W-2] = '1'
    for x in range(1, W - 1): g[11][x] = '6' if x < W - 3 else '5'   # 앞벽 윗테 (빛)
    for x in range(1, W - 1): g[7][x] = 'o'

def lock(g, top):
    # 금 자물쇠 판 x 12..17, rows top..top+6
    x0 = 12
    for y in range(top, top + 7):
        for x in range(x0, x0 + 6): g[y][x] = 'o'
    for y in range(top + 1, top + 6):
        for x in range(x0 + 1, x0 + 5):
            g[y][x] = 'y'
        g[y][x0 + 4] = '4'
    g[top + 1][x0 + 1] = 'w'; g[top + 1][x0 + 2] = 'w'; g[top + 2][x0 + 1] = 'w'
    for x in range(x0 + 1, x0 + 5): g[top + 5][x] = '4'
    g[top + 3][x0 + 2] = 'o'; g[top + 3][x0 + 3] = 'o'; g[top + 4][x0 + 2] = 'o'; g[top + 4][x0 + 3] = 'o'

WOOD = '123456'
def planks(g, top, n, h, light):
    # 판자 n 장 (높이 h): 윗줄 밝음 · 가는 가로 결 (한 단계씩 번갈아, 군데군데 끊김) · 아랫줄 어둠 · 이음 = 외곽색 (원작 22장 나무 상자)
    import random
    r = random.Random(top * 31 + n)
    for k in range(n):
        y0 = top + k * h
        base = light - (1 if k == n - 1 and n > 1 else 0)
        for i in range(h):
            y = y0 + i
            for x in range(1, W - 1):
                if i == 0: c = base + 1
                elif i == h - 1: c = base - 2
                else:
                    c = base if (i % 2 == 1) else base - 1
                    if r.random() < 0.12: c = base - 1 if c == base else base
                if x == 1: c = min(c + 1, 5)
                elif x == W - 2: c = max(c - 1, 0)
                g[y][x] = WOOD[max(0, min(5, c))]
        if k < n - 1:
            for x in range(1, W - 1): g[y0 + h - 1][x] = '1' if x < W - 2 else 'o'
def bands(g, y0, y1, ramp):
    for bx in BANDS:
        for y in range(y0, y1):
            a, b, c = ramp(y)
            g[y][bx], g[y][bx+1], g[y][bx+2] = a, b, c

def make(open_):
    g = blank(); box(g, open_)
    planks(g, 12, 3, 4, 3)                                   # 몸통 앞면 판자 셋
    bands(g, 12, 25, lambda y: ('g', 'n', 'm') if y < 20 else ('n', 'm', 'k'))
    for bx in BANDS:
        for ry in (13, 22): g[ry][bx + 1] = 'h'                 # 못
    if open_:
        lid_open(g); planks(g, 1, 2, 3, 1)
        for y in range(1, 7): g[y][0] = g[y][1] = 'o'; g[y][W-1] = g[y][W-2] = 'o'
        bands(g, 1, 7, lambda y: ('n', 'm', 'k') if y < 4 else ('m', 'k', 'k'))
        lock(g, 12)
    else:
        lid_closed(g); planks(g, 1, 2, 4, 4)
        g[1][1] = 'o'; g[1][W-2] = 'o'
        bands(g, 1, 9, lambda y: ('h', 'h', 'g') if y <= 3 else ('h', 'g', 'n'))
        bands(g, 9, 11, lambda y: ('g', 'n', 'm') if y == 9 else ('n', 'm', 'k'))
        for x in range(1, W - 1): g[9][x] = g[9][x] if g[9][x] in 'hgnmk' else ('3' if x > 1 else '4'); g[10][x] = g[10][x] if g[10][x] in 'hgnmk' else '1'
        lock(g, 8)
    return [''.join(r) for r in g]

def render(rows, scale=1):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': im.putpixel((x, y), tuple(int(PAL[ch][i:i+2], 16) for i in (1, 3, 5)) + (255,))
    return im

def shadow(tile, ox, oy):
    # 원작 유닛 그림자처럼 망점 (체크 무늬) 타원
    px = tile.load()
    cx, cy, rx, ry = ox + W / 2 + 2, oy + H - 1, W / 2 + 2, 3.5
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 and (x + y) % 2 == 0:
                px[x, y] = (32, 32, 32)

if __name__ == '__main__':
    out = sys.argv[1]
    closed, opened = make(False), make(True)
    open(out + '.txt', 'w').write('closed\n' + '\n'.join(closed) + '\nopen\n' + '\n'.join(opened) + '\n')
    tiles = []
    for n, (tx, ty) in [('01', (0, 192)), ('01', (0, 480)), ('22', (560, 0)), ('36', (0, 0))]:
        tiles.append(Image.open(f'public/assets/stages/{n}.png').convert('RGB').crop((tx, ty, tx + 56, ty + 48)))
    crate = Image.open('public/assets/stages/22.png').convert('RGB').crop((280, 0, 336, 48))
    unit = Image.open('public/assets/units/000.png').convert('RGBA').crop((0, 0, 56, 48))
    sheet = Image.new('RGB', (56 * 6, 48 * 2), (60, 60, 60))
    for i, t in enumerate(tiles):
        for j, rows in enumerate((closed, opened)):
            c = t.copy(); ox, oy = 13, 48 - H - 4
            shadow(c, ox, oy); s = render(rows); c.paste(s, (ox, oy), s)
            sheet.paste(c, (56 * i, 48 * j))
    sheet.paste(crate, (56 * 4, 0)); bg = tiles[2].copy(); bg.paste(unit, (0, 0), unit); sheet.paste(bg, (56 * 4, 48))
    sheet.paste(tiles[0], (56 * 5, 0)); u2 = tiles[0].copy(); u2.paste(unit, (0, 0), unit); sheet.paste(u2, (56 * 5, 48))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(out + '.png')

def with_shadow(rows):
    # 상자 + 망점 그림자 (원작 유닛 발밑처럼 체크 무늬, 's') — 폭 W+4, 높이 H+3
    WW, HH = W + 4, H + 3
    g = [['.'] * WW for _ in range(HH)]
    cx, cy, rx, ry = W / 2 + 2, H - 0.5, W / 2 + 2, 3.5
    for y in range(HH):
        for x in range(WW):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 and (x + y) % 2 == 0: g[y][x] = 's'
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': g[y][x] = ch
    return [''.join(r) for r in g]

def ts():
    out = []
    for name, rows in (('closed', with_shadow(make(False))), ('open', with_shadow(make(True)))):
        out.append(f'  {name}: [\n' + '\n'.join(f"    '{r}'," for r in rows) + '\n  ],')
    return '\n'.join(out)
