import sys, struct
def probe(path, verbose=False):
    d=open(path,'rb').read()
    n=struct.unpack_from('<H',d,43)[0]
    p=45; out=[]
    for i in range(n):
        if d[p:p+3] not in (b'FRT',b'FGT'):
            out.append(('BAD',hex(p),d[p:p+16].hex())); break
        name=d[p+3:p+43]
        a,b,w,h,size=struct.unpack_from('<HBHHI',d,p+43)
        q=p+43+11
        if b==1: q+=768
        out.append((i,hex(p),a,b,w,h,size))
        p=q+size
    return n,out,p,len(d)
for f in sys.argv[1:]:
    try:
        n,out,p,L=probe(f)
        print(f, 'count',n,'end',p,'len',L, 'OK' if p==L else 'MISMATCH')
        for e in out[:4]: print('   ',e)
    except Exception as e: print(f,'ERR',e)
