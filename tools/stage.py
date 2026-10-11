"""스테이지 맵 데이터 (ECLIPSE.LML, 레코드 2000B × 43) 파서와 맵 렌더러.
사용: stage.py N [out.png]  — N은 1부터."""
import os, struct, sys
ROOT = os.path.join(os.path.dirname(__file__), '..')
REC = 2000
TW, TH, COLS = 56, 48, 11  # 타일 크기, 타일 시트의 열 수 (1px 흰 구분선 포함 57×49 간격)


def load(n):
    d = open(os.path.join(ROOT, 'original', 'ECLIPSE.LML'), 'rb').read()[(n - 1) * REC:n * REC]
    _, _, ntiles, tw, th, _, w, h = struct.unpack_from('<8H', d, 0)
    name = d[24:36].split(b'\0')[0].decode('ascii', 'replace').strip()
    cells = w * h
    layers = [list(d[100 + k * cells:100 + (k + 1) * cells]) for k in range(3)]
    return dict(n=n, ntiles=ntiles, tw=tw, th=th, w=w, h=h, tileset=name,
                tiles=layers[0], layer2=layers[1], layer3=layers[2], header=list(d[:100]))


def tile_images(n):
    from PIL import Image
    d = os.path.join(ROOT, 'build', 'img', f'ECP{n:02d}.ECP')
    out = []
    for k in sorted(os.listdir(d))[:-1]:  # 마지막 시트는 미니맵
        sheet = Image.open(os.path.join(d, k)).convert('RGB')
        for r in range(sheet.height // (TH + 1)):
            for c in range(COLS):
                x, y = 1 + c * (TW + 1), 1 + r * (TH + 1)
                out.append(sheet.crop((x, y, x + TW, y + TH)))
    return out


def render(n, out):
    from PIL import Image
    s = load(n)
    tiles = tile_images(n)
    img = Image.new('RGB', (s['w'] * TW, s['h'] * TH))
    for i, t in enumerate(s['tiles']):
        img.paste(tiles[t], ((i % s['w']) * TW, (i // s['w']) * TH))
    img.save(out)
    return s


if __name__ == '__main__':
    n = int(sys.argv[1])
    s = render(n, sys.argv[2] if len(sys.argv) > 2 else f'build/stage{n:02d}.png')
    print({k: v for k, v in s.items() if k not in ('tiles', 'layer2', 'layer3', 'header')})
    for name in ('layer2', 'layer3'):
        print(name, sorted(set(s[name])))
        for r in range(s['h']):
            print(' ', ''.join('.123456789ABCDEF'[v] if v < 16 else '#' for v in s[name][r * s['w']:(r + 1) * s['w']]))
