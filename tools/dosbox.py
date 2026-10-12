"""DOSBox 로 원작을 띄워 조작·캡처한다 (macOS, 원작 화면 대조용).

사용:
  dosbox.py launch                 원작 실행 (DOSBOX_DIR/eclipse-capture.conf 를 만들어 씀)
  dosbox.py shot NAME              창을 640×480 게임 좌표 그림으로 → build/dosbox/NAME.png
  dosbox.py click|rmb|move X Y [--wait 초] [--shot NAME]   게임 좌표로 입력
  dosbox.py key KEYCODE [--wait 초] [--shot NAME]          macOS 키코드 (53 Esc, 36 Return, 125 ↓)

필요: .env 의 DOSBOX_DIR (dosbox.app·ECP·iso 가 있는 곳, 기존 DOSBox 설정의 [autoexec] 로 C:·D: 마운트),
Claude 앱에 손쉬운 사용·화면 기록 권한. 입력 전에 DOSBox 를 맨 앞으로 올리고, 맨 앞이 아니면 보내지 않는다.
DOSBox 창 크기 = windowresolution=original (게임 1px = 1pt), 제목줄 28pt.
"""
import os, sys, time, argparse, subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'build' / 'dosbox'
INP = OUT / 'inp'
TITLE = 28


def env(key):
    if key in os.environ: return os.environ[key]
    f = ROOT / '.env'
    if f.exists():
        for line in f.read_text().splitlines():
            if line.startswith(key + '='): return line.split('=', 1)[1].strip()
    sys.exit(f'.env 에 {key} 가 없습니다 (.env.example 참고)')


def helper():
    src = ROOT / 'tools' / 'dosbox' / 'inp.swift'
    if not INP.exists() or INP.stat().st_mtime < src.stat().st_mtime:
        OUT.mkdir(parents=True, exist_ok=True)
        subprocess.run(['swiftc', '-O', str(src), '-o', str(INP)], check=True)
    return str(INP)


def window():
    r = subprocess.run([helper(), 'win'], capture_output=True, text=True)
    if r.returncode: sys.exit('DOSBox 창이 없습니다 (dosbox.py launch)')
    wid, x, y, w, h = (int(float(v)) for v in r.stdout.split())
    return wid, x, y, w, h


def launch():
    d = Path(env('DOSBOX_DIR')).expanduser()
    prefs = Path.home() / 'Library' / 'Preferences' / 'DOSBox 0.74-3-3 Preferences'
    conf = d / 'eclipse-capture.conf'
    lines = []
    for line in prefs.read_text(errors='replace').splitlines():
        if line.startswith('captures='): line = f'captures={d / "capture"}'
        if line.startswith('autolock='): line = 'autolock=false'  # 클릭해도 마우스를 붙잡지 않게
        lines.append(line)
    lines += ['cd \\ECP', 'ECP.EXE']
    conf.write_text('\n'.join(lines) + '\n')
    subprocess.run(['open', '-a', str(d / 'dosbox.app'), '--args', '-conf', str(conf)], check=True)


def shot(name):
    wid, *_ = window()
    OUT.mkdir(parents=True, exist_ok=True)
    raw = OUT / '_raw.png'
    subprocess.run(['screencapture', '-x', '-o', '-l', str(wid), str(raw)], check=True)
    im = Image.open(raw)
    s = im.width / 640
    im = im.crop((0, im.height - int(480 * s), im.width, im.height)).resize((640, 480), Image.NEAREST)
    im.convert('RGB').save(OUT / f'{name}.png')
    raw.unlink()
    print(OUT / f'{name}.png')


def send(*args):
    subprocess.run(['osascript', '-e', 'tell application "DOSBox" to activate'], check=True, capture_output=True)
    for _ in range(5):  # 맨 앞으로 올라올 때까지 잠깐 기다림
        time.sleep(0.3)
        r = subprocess.run([helper(), *map(str, args)], capture_output=True, text=True)
        if not r.stdout.startswith('ABORT'): break
    if r.returncode: sys.exit(r.stdout.strip() or 'input failed')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd'); ap.add_argument('args', nargs='*')
    ap.add_argument('--wait', type=float, default=1.5); ap.add_argument('--shot')
    a = ap.parse_args()
    if a.cmd == 'launch': return launch()
    if a.cmd == 'shot': return shot(a.args[0])
    if a.cmd in ('click', 'rmb', 'move'):
        _, x, y, *_ = window()
        send(a.cmd, x + int(a.args[0]), y + TITLE + int(a.args[1]))
    elif a.cmd == 'key':
        send('key', a.args[0])
    else:
        sys.exit(__doc__)
    time.sleep(a.wait)
    if a.shot: shot(a.shot)


main()
