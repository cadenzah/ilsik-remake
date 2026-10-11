"""FVT 묶음 안의 Creative Voice(VOC) 들을 build/snd/<파일>/NNN.wav 로 변환한다."""
import os, struct, sys, wave
ROOT = os.path.join(os.path.dirname(__file__), '..')
SIG = b'Creative Voice File\x1a'


def voc_to_pcm(d, p):
    """p = VOC 시작. (rate, pcm bytes) 반환. 블록 1(8비트 PCM)과 2(이어짐)만 처리."""
    hdr = struct.unpack_from('<H', d, p + 20)[0]
    q = p + hdr
    rate, pcm = None, bytearray()
    while q < len(d):
        t = d[q]
        if t == 0:
            break
        size = d[q + 1] | d[q + 2] << 8 | d[q + 3] << 16
        body = d[q + 4:q + 4 + size]
        if t == 1:
            rate = rate or 1000000 // (256 - body[0])
            pcm += body[2:]
        elif t == 2:
            pcm += body
        q += 4 + size
    return rate or 11025, bytes(pcm)


def extract(name):
    d = open(os.path.join(ROOT, 'original', name), 'rb').read()
    out = os.path.join(ROOT, 'build', 'snd', name)
    os.makedirs(out, exist_ok=True)
    starts, p = [], d.find(SIG)
    while p >= 0:
        starts.append(p)
        p = d.find(SIG, p + 1)
    for i, s in enumerate(starts):
        rate, pcm = voc_to_pcm(d, s)
        with wave.open(os.path.join(out, f'{i:03d}.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(1); w.setframerate(rate); w.writeframes(pcm)
    return starts


if __name__ == '__main__':
    for n in sys.argv[1:] or ['ECLIPSE1.FVT', 'ECLIPSE2.FVT', 'ECPANI.FVT', 'ECPMARK.FVT']:
        s = extract(n)
        print(n, len(s), 'voc')
