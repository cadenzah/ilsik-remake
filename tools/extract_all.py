"""original/ 의 모든 FRT 컨테이너를 build/img/<파일명>/NNN.png 로 추출하고 build/catalog.json 을 만든다.
대용량 *.UND 는 --und 를 줄 때만 추출 (목록은 항상 기록)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from frt import is_frt, entries, to_image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC, OUT = os.path.join(ROOT, 'original'), os.path.join(ROOT, 'build')
with_und = '--und' in sys.argv
catalog = {}
for name in sorted(os.listdir(SRC)):
    data = open(os.path.join(SRC, name), 'rb').read()
    if not is_frt(data):
        continue
    skip = name.endswith('.UND') and not with_und
    d = os.path.join(OUT, 'img', name)
    os.makedirs(d, exist_ok=True)
    items = []
    for i, off, w, h, pal, rle in entries(data):
        items.append([w, h])
        if not skip:
            to_image(w, h, pal, rle).save(os.path.join(d, f'{i:03d}.png'))
    catalog[name] = {'count': len(items), 'extracted': not skip, 'sizes': items}
    print(f'{name:14s} {len(items):5d}{" (skipped)" if skip else ""}')
json.dump(catalog, open(os.path.join(OUT, 'catalog.json'), 'w'))
