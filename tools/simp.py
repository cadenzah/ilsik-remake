"""fpdis 출력 단순화 (전투 함수 20ec:6e92 용). stdin → stdout.
U[A]=행동 유닛, U[T]=현재 대상 유닛, TR[x]=부대, C.=전투구조체([bp+6])"""
import sys, re
L = [l.rstrip('\n') for l in sys.stdin]
out = []; i = 0
def body(l): return l.split('  ', 1)[1] if '  ' in l else l
while i < len(L):
    b = body(L[i])
    if b == 'les bx, ptr [bp + 6]' and i+1 < len(L) and 'es:[bx + 0x1be6]' in body(L[i+1]):
        j = i + 1; tag = '?'; kind = 'TR'; extra = ''
        while j < len(L) and j < i + 30:
            bj = body(L[j])
            if 'es:[di]' in bj or '0x320' in bj: tag = 'T'
            if '0x1d58' in bj or '0x1d5a' in bj: tag = 'A'
            if '0x76' in bj and 'imul' in bj: kind = 'U'
            if bj == 'add bx, ax' and (kind == 'U' or 'add ax, ax' in body(L[j-1])):
                if kind == 'TR': extra = '+2m'
                break
            if bj.startswith('mov ax, word ptr es:[bx + 4]'):  # 포인터 계산 (복사용)
                kind = 'Uptr'
            j += 1
        # 그 사이 push ax / pop ax 보존
        mid = [body(L[k]) for k in range(i, j) if body(L[k]) in ('push ax', 'pop ax') or body(L[k]).startswith(('mov ax, word ptr es:[bx + 0x', 'sub ax', 'add ax, word', 'imul ax, ax, 0x82', 'mov ax, 0x', 'mov dx, ax', 'imul dx', 'pop dx', 'sub ax, dx', 'xor dx'))]
        if j - i > 3:
            pre = ''
            out.append(f'{L[i].split()[0]}  bx = {kind}[{tag}]{extra}' + (('   {' + '; '.join(mid) + '}') if mid else ''))
            i = j + 1; continue
    if b in ('push es', 'pop es', 'mov es, word ptr [bp + 8]'): i += 1; continue
    if b == 'les bx, ptr [bp + 6]' or b == 'les si, ptr [bp + 6]': i += 1; continue
    b = b.replace('es:[bx + 0x', 'C+0x') if False else b
    out.append(L[i].split()[0] + '  ' + b.replace('word ptr ', '').replace('dword ptr ', 'd').replace('qword ptr ', 'q'))
    i += 1
print('\n'.join(l[5:] if l.startswith('20ec:') else l for l in out))
