"""FULLSOFT.FNT (한글/영문 비트맵 글꼴) 해석·렌더·웹 내보내기. 형식은 .claude/docs/formats.md 'FULLSOFT.FNT' 절.
사용: python tools/font.py render OUT.png "문자열" [--scale N]   |   python tools/font.py export
  export = public/assets/ui/eclipse-font.woff (픽셀을 사각형 윤곽으로 옮긴 웹 글꼴, 1px = 64 단위, 16px 에서 원작 크기)
  - 영문(1바이트 <0x80): 0x7483 + c*15, 8×15 (행당 1바이트, MSB 왼쪽), 진행 8
  - 한글(CP949 KS X 1001 2바이트, 행 A1~C8): 0x6dc8d + ((hi-0xA1)*94 + lo-0xA1)*30, 16×15 (행당 2바이트 big-endian), 진행 16
  (EXE 3821:0114 한국어 모드 [0x2706]=1, 3821:02ea 글리프 읽기, 3821:06bb 찍기, 3821:079b 문자열)"""
import json, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
FNT = os.path.join(ROOT, 'original', 'FULLSOFT.FNT')
ASCII_OFF, KS_OFF = 0x7483, 0x6dc8d
H = 15                      # 글리프 높이 (영문·한글 공통)
KS_ROWS = range(0xA1, 0xC9)  # 파일에 실린 KS 행 (40행 × 94 = 3760자)

_d = None
def data():
    global _d
    if _d is None: _d = open(FNT, 'rb').read()
    return _d


def glyph(ch):
    """문자 → (폭, 15행 비트 정수 목록) 또는 None (파일에 없음)."""
    d = data()
    c = ord(ch)
    if c < 0x80:
        o = ASCII_OFF + c * 15
        return 8, list(d[o:o + 15])
    try:
        b = ch.encode('cp949')
    except UnicodeEncodeError:
        return None
    if len(b) != 2 or b[0] not in KS_ROWS or not 0xA1 <= b[1] <= 0xFE:
        return None  # CP949 확장 한글(통합형)·한자 등: 원작 글꼴에 없음
    o = KS_OFF + ((b[0] - 0xA1) * 94 + b[1] - 0xA1) * 30
    return 16, [d[o + 2 * r] << 8 | d[o + 2 * r + 1] for r in range(H)]


def blit(im, x, y, ch, color):
    g = glyph(ch)
    if g is None: return 16
    w, rows = g
    px = im.load()
    for r, bits in enumerate(rows):
        for i in range(w):
            if bits >> (w - 1 - i) & 1 and 0 <= x + i < im.width and 0 <= y + r < im.height:
                px[x + i, y + r] = color
    return w


def draw_text(im, x, y, s, color):
    """원작 3821:079b 와 같음: 줄바꿈 없음, 1바이트 +8 / 2바이트 +16."""
    for ch in s:
        x += blit(im, x, y, ch, color)
    return x


def text_width(s):
    return sum((8 if ord(c) < 0x80 else 16) for c in s)


def render(s, scale=2):
    """원작 화면처럼: 색 7 (170,170,170) 로 x, 색 0 (검정) 으로 x+1 — 회색 그림자 + 검은 글자."""
    lines = s.split('\n')
    w = max(text_width(l) for l in lines) + 1 + 8
    im = Image.new('RGB', (w, len(lines) * 16 + 8), (240, 232, 208))
    for k, l in enumerate(lines):
        draw_text(im, 4, 4 + k * 16, l, (170, 170, 170))
        draw_text(im, 5, 4 + k * 16, l, (0, 0, 0))
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST)


def charset():
    """내보낼 문자: ASCII 0x20~0x7E + KS 행 A1~C8 중 비어 있지 않은 글리프."""
    out = [chr(c) for c in range(0x20, 0x7F)]
    for hi in KS_ROWS:
        for lo in range(0xA1, 0xFF):
            try:
                ch = bytes([hi, lo]).decode('cp949')
            except UnicodeDecodeError:
                continue
            g = glyph(ch)
            if g and any(g[1]): out.append(ch)
    return out


UNIT = 64        # 글꼴 단위 / 픽셀. 1em = 16px = 1024
ASCENT = 13      # 기준선 위 줄 수 (영문 A 가 0~12행, g 의 꼬리가 13행)


def outline(w, rows):
    """비트맵을 합친 윤곽 (구멍 포함) 목록으로. 픽셀마다 시계 방향 네 변을 내고, 이웃과 겹치는 변을 지운 뒤 이어 붙인다."""
    edges = {}
    for r, bits in enumerate(rows):
        for c in range(w):
            if not bits >> (w - 1 - c) & 1: continue
            x0, x1, top, bot = c, c + 1, ASCENT - r, ASCENT - r - 1
            for a, b in (((x0, top), (x1, top)), ((x1, top), (x1, bot)), ((x1, bot), (x0, bot)), ((x0, bot), (x0, top))):
                if (b, a) in edges: del edges[(b, a)]
                else: edges[(a, b)] = True
    nxt = {}
    for a, b in edges: nxt.setdefault(a, []).append(b)
    loops = []
    while nxt:
        a = next(iter(nxt)); loop = [a]
        while True:
            b = nxt[a].pop()
            if not nxt[a]: del nxt[a]
            if b == loop[0]: break
            loop.append(b); a = b
        # 같은 방향으로 이어지는 점은 뺀다
        pts = [p for i, p in enumerate(loop)
               if (loop[i - 1][0] - p[0]) * (loop[(i + 1) % len(loop)][1] - p[1]) != (loop[i - 1][1] - p[1]) * (loop[(i + 1) % len(loop)][0] - p[0])]
        loops.append([(x * UNIT, y * UNIT) for x, y in pts])
    return loops


def export(outdir=None):
    """원작 글꼴을 웹 글꼴로 (eclipse-font.woff). 글자 = charset() (ASCII + KS 기호 + 한글 2350)."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    outdir = outdir or os.path.join(ROOT, 'public', 'assets', 'ui')
    os.makedirs(outdir, exist_ok=True)
    order, cmap, metrics, glyphs = ['.notdef'], {}, {'.notdef': (1024, 0)}, {'.notdef': TTGlyphPen(None).glyph()}
    for ch in charset():
        w, rows = glyph(ch)
        name = f'u{ord(ch):04X}'
        pen = TTGlyphPen(None)
        for loop in outline(w, rows):
            pen.moveTo(loop[0])
            for p in loop[1:]: pen.lineTo(p)
            pen.closePath()
        g = pen.glyph()
        g.recalcBounds(None)
        order.append(name); cmap[ord(ch)] = name; glyphs[name] = g
        metrics[name] = (w * UNIT, getattr(g, 'xMin', 0))
    fb = FontBuilder(16 * UNIT, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    asc, desc = ASCENT * UNIT, (H - ASCENT) * UNIT
    fb.setupHorizontalHeader(ascent=asc, descent=-desc)
    fb.setupNameTable({'familyName': 'Eclipse Bitmap', 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=-desc, sTypoLineGap=0, usWinAscent=asc, usWinDescent=desc)
    fb.setupPost()
    fb.font.flavor = 'woff'
    out = os.path.join(outdir, 'eclipse-font.woff')
    fb.save(out)
    return len(cmap), os.path.getsize(out)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'render':
        sc = int(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else 2
        render(sys.argv[3].replace('\\n', '\n'), sc).save(sys.argv[2])
    elif cmd == 'export':
        print(export())
    else:
        print(__doc__)
