"""여러 PNG를 축소 격자 1장으로 합친다. 사용: montage.py OUT.png [--w 셀폭] [--cols N] 파일들..."""
import sys, argparse
from PIL import Image, ImageDraw
ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('files', nargs='+')
ap.add_argument('--w', type=int, default=160); ap.add_argument('--cols', type=int, default=8)
a = ap.parse_args()
ims = [Image.open(f).convert('RGB') for f in a.files]
cw = a.w
ch = max(int(im.height * cw / max(im.width, cw)) if im.width > cw else im.height for im in ims) + 12
rows = (len(ims) + a.cols - 1) // a.cols
sheet = Image.new('RGB', (cw * a.cols, ch * rows), (40, 40, 40))
dr = ImageDraw.Draw(sheet)
for k, (f, im) in enumerate(zip(a.files, ims)):
    if im.width > cw:
        im = im.resize((cw, int(im.height * cw / im.width)))
    x, y = (k % a.cols) * cw, (k // a.cols) * ch
    sheet.paste(im, (x, y + 12))
    dr.text((x + 2, y), f.split('/')[-2][:10] + '/' + f.split('/')[-1][:3], fill=(255, 255, 0))
sheet.save(a.out)
