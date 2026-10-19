# 무기 시트(왼쪽부터 id 순서) → assets/weapons/<id>.png (240×960, 쥐는 점 (120,800), 칼끝 y = 800 − 칼끝 거리) + 아이콘(45도)
# 사용: python3 v3_weapon_sheet.py <시트> id1:거리1 id2:거리2 ...   (v3_iron.py와 같은 방식, 2026-10-18)
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from punch import segs
from PIL import Image
import numpy as np, json
G='/home/claude/seolhwa-rpg/'; A=G+'assets/weapons/'
sh=Image.open(sys.argv[1]).convert('RGB'); spec=[x.split(':') for x in sys.argv[2:]]
def segs2(im,th=200):
    a=np.array(im); col=(a.min(2)<th).sum(0)>3; out=[]; x=0
    while x<len(col):
        if col[x]:
            s0=x
            while x<len(col) and col[x:x+15].any(): x+=1
            if x-s0>20: out.append((s0,x))
        x+=1
    return out
ss=segs(sh)
if len(ss)!=len(spec): ss=segs2(sh)
assert len(ss)==len(spec),(ss,spec)
def fit(im,name,N=256,PAD=18):
    im=im.crop(im.getbbox()); s=(N-2*PAD)/max(im.size)
    im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    c=Image.new('RGBA',(N,N)); c.alpha_composite(im,((N-im.width)//2,(N-im.height)//2)); c.save(G+f'assets/items/icons/{name}.png',optimize=True)
out={}
for (name,T),(s0,e0) in zip(spec,ss):
    T=int(T); c=cutout(sh,(max(0,s0-10),0,min(sh.width,e0+10),sh.height))
    # 기울기: 칼날(위 55%)만으로 잼 — 손잡이 끝 술이 옆으로 늘어져도 칼이 기울지 않게 (2026-10-19)
    a=np.array(c)[...,3]>128; h0=a.shape[0]; ys,xs=np.nonzero(a[:int(h0*0.55)]); k=np.polyfit(ys,xs,1)[0]; ang=np.degrees(np.arctan(k))
    if abs(ang)>0.3: c=c.rotate(-ang,resample=Image.BICUBIC,expand=True); c=c.crop(c.getbbox())
    a=np.array(c)[...,3]>128; h=a.shape[0]
    # 칼 가운데 축(위 55%의 가운데) ± 띠 안에서만 폭을 잼 → 옆으로 늘어진 술은 셈에서 뺌
    ys,xs=np.nonzero(a[:int(h*0.55)]); ax=int(np.median(xs)); band=max(40,int(h*0.10))
    ab=a[:,max(0,ax-band):ax+band]; wid=ab.sum(1)
    lower=np.arange(int(h*0.55),int(h*0.85)); guard=int(lower[np.argmax(wid[lower])])
    grip_w=np.median(wid[guard+10:int(h*0.85)]); end=h
    # 손잡이 끝: 아래 15%에서 띠 안 폭이 손잡이의 1.6배 넘게 넓어지는 첫 줄(고리·구슬·술 매듭)
    for y in range(int(h*0.85),h):
        if wid[y]>1.6*grip_w: end=y; break
    grip=(guard+end)/2; s=T/grip
    c=c.resize((max(1,round(c.width*s)),round(h*s)),Image.LANCZOS); gy=round(grip*s)
    can=Image.new('RGBA',(240,960)); can.alpha_composite(c,(120-c.width//2,800-gy)); can.save(A+name+'.png',optimize=True)
    fit(can.rotate(-45,resample=Image.BICUBIC,expand=True),name)
    out[name]=dict(tipFromGrip=T,tipY=can.getbbox()[1],buttY=can.getbbox()[3],ringEnd=end<h)
print(json.dumps(out))
v=json.load(open(A+'weapons_v3.json'))
for n,d in out.items(): v[n]=dict(tipFromGrip=d['tipFromGrip'],note='tools/art/v3_weapon_sheet.py, 칼끝 = 800 − tipFromGrip, 쥐는 점 = 코등이와 손잡이 끝(고리 위)의 가운데')
json.dump(v,open(A+'weapons_v3.json','w'),indent=0,ensure_ascii=False)
