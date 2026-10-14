# 새 그림체(v3) 홑옷 무기 자세 + 손 덮개 + 주먹(쥐는 점) 다시 재기 + 목검 3종
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from punch import segs, bodyx, W
from PIL import Image, ImageOps
import numpy as np, json, os
from scipy import ndimage
S='/home/claude/seolhwa-rpg/assets/source/v3/'
R='/home/claude/seolhwa-rpg/assets/characters/outfit1_hotot/'
WP=json.load(open('/home/claude/seolhwa-rpg/data/weapons.json'))
def fig(im,s,e): return cutout(im,(max(0,s-10),0,min(im.width,e+10),im.height))
def centertop(c):
    a=np.array(c)[...,3]>128; bx=bodyx(c); ys=np.nonzero(a[:,int(bx-25):int(bx+25)].any(1))[0]; return ys.min()
def faces_right(c):
    a=np.array(c).astype(int); al=a[...,3]>128; h=a.shape[0]; top=slice(0,int(h*0.3))
    r,g,b=a[...,0],a[...,1],a[...,2]; skin=(r>200)&(g>150)&(b>110)&(r>g)&(g>b)&al
    hx=np.nonzero(al[top])[1].mean(); sx=np.nonzero(skin[top])[1]
    return len(sx)>20 and sx.mean()>hx
def put(c,s):
    c2=c.resize((round(c.width*s),round(c.height*s)),Image.LANCZOS); bx=bodyx(c2)
    can=Image.new('RGBA',(W,720)); can.alpha_composite(c2,(round(W/2-bx),700-c2.height)); return can
poses={}
for kind,f in [('hold','outfit1_hotot_hold.jpg'),('hold_step','outfit1_hotot_hold_step.jpg'),('raise','outfit1_hotot_raise.jpg'),('swing','outfit1_hotot_swing.jpg'),('strike','outfit1_hotot_strike.jpg')]:
    im=Image.open(S+f).convert('RGB'); ss=segs(im); fs=[fig(im,*ss[i]) for i in range(3)]
    if faces_right(fs[1]): fs[1]=ImageOps.mirror(fs[1]); print(kind,'side mirrored')
    s=640/fs[0].height if kind.startswith('hold') else 640/(fs[2].height-centertop(fs[2]))
    for n,c in zip(['front','side','back'],fs):
        p=put(c,s); p.save(R+f'{n}_{kind}.png'); poses[f'{n}_{kind}']=p
# 주먹 찾기: 옛 쥐는 점 근처(반지름 60)에서 가장 큰 피부색 덩어리 → 그 가운데가 새 쥐는 점, 그 덩어리(+4px)가 손 덮개
src=WP['attach']['outfit1_hotot']
grips={}
for n,img in poses.items():
    d,k=n.split('_',1); x,y=src[k][d]['grip']
    A=np.array(img).astype(int); r,g,b,al=A[...,0],A[...,1],A[...,2],A[...,3]
    skin=(al>200)&(r>185)&(r-b>30)&(r-b<125)&(g>120)
    yy,xx=np.mgrid[:720,:640]; near=((xx-x)**2+(yy-y)**2)<60**2
    m=skin&near; lab,nl=ndimage.label(m)
    if nl==0: print('NO FIST',n); continue
    sz=ndimage.sum(m,lab,range(1,nl+1)); comp=lab==(np.argmax(sz)+1)
    comp=ndimage.binary_closing(comp,iterations=3)
    ys,xs=np.nonzero(comp); cx,cy=int(round(xs.mean())),int(round(ys.mean()))
    near2=((xx-cx)**2+(yy-cy)**2)<38**2
    cover=ndimage.binary_dilation(comp,iterations=4)&(al>0)&near2
    o=np.array(img).copy(); o[...,3]=np.where(cover,o[...,3],0); Image.fromarray(o.astype(np.uint8)).save(R+n+'_hand.png')
    grips[n]=[cx,cy]; print(n,'old',(x,y),'new',(cx,cy))
json.dump(grips,open('/tmp/claude-0/-home-claude-seolhwa-rpg/1798b720-9bbd-5e1d-af87-0516171baaa5/scratchpad/grips_v3.json','w'),indent=0)
# 목검 3종: 시트 왼쪽부터 박달·참나무·소나무(색으로 확인), 길이 비율은 칼끝 거리 420:430:442
A='/home/claude/seolhwa-rpg/assets/weapons/'
sh=Image.open(S+'weapons_sheet.webp').convert('RGB'); ss=segs(sh)
L={'wood_pine':480,'wood_oak':491,'wood_bakdal':505}
cuts={}
for (s0,e0) in ss:
    c=cutout(sh,(max(0,s0-10),0,min(sh.width,e0+10),sh.height)); a=np.array(c); al=a[...,3]>128
    lum=a[...,:3][al].mean(); cuts[lum]=c
order=sorted(cuts)  # 어두운 것부터
named={'wood_bakdal':cuts[order[0]],'wood_oak':cuts[order[1]],'wood_pine':cuts[order[2]]}
info={}
for name,c in named.items():
    a=np.array(c)[...,3]>128; ys,xs=np.nonzero(a); k=np.polyfit(ys,xs,1)[0]; ang=np.degrees(np.arctan(k))
    if abs(ang)>0.3: c=c.rotate(-ang,resample=Image.BICUBIC,expand=True); c=c.crop(c.getbbox())
    Lp=L[name]; s=Lp/c.height; c=c.resize((max(1,round(c.width*s)),Lp),Image.LANCZOS)
    a=np.array(c)[...,3]>128; wid=a.sum(1); lower=np.arange(int(Lp*0.55),Lp)
    guard=int(lower[np.argmax(wid[lower])])          # 코등이 = 아래쪽에서 가장 넓은 줄
    grip_y=int((guard+Lp)/2)                          # 손잡이 가운데
    can=Image.new('RGBA',(240,960)); can.alpha_composite(c,(120-c.width//2,800-grip_y)); can.save(A+name+'.png')
    info[name]=dict(length=Lp,guard=guard,gripFromTop=grip_y,tipFromGrip=grip_y,tilt=round(float(ang),2))
print(json.dumps(info))
json.dump(info,open(A+'weapons_v3.json','w'),indent=0)
