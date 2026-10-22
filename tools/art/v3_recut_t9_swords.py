# 2026-10-23: 사인검·칠성검 다시 오리기 — 술이 오른쪽으로 길어 칼 전체가 왼쪽으로 치우쳐 오려졌음
# (손잡이 가운데 x≈22, 규격은 120 → 손이 손잡이를 안 쥔 것처럼 보임, 칠성검은 칼날 왼쪽이 잘림)
# 규격: 240×960, 칼날·손잡이 축 x=120, 쥐는 점 (120,800). 세로 배율·위치는 지금 그림(칼끝·고리 아래끝)에 맞춤.
# 술은 캔버스 오른쪽 끝에서 잘리므로 끝 24px를 부드럽게 흐리게 함.
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from PIL import Image
import numpy as np
S='/home/claude/seolhwa-rpg/assets/source/v3/weapons_tier9_sheet.webp'
D='/home/claude/seolhwa-rpg/assets/weapons/'
sheet=Image.open(S).convert('RGB')

def axis_ends(a, cx):
    """축 기둥(cx±3)에서 칼끝 y와 고리 아래끝 y"""
    col=a[:, max(0,int(cx)-3):int(cx)+4].any(1); ys=np.nonzero(col)[0]; return ys.min(), ys.max()

def blade_cx(a, y0, y1):
    cs=[]
    for y in range(y0,y1,8):
        xs=np.nonzero(a[y])[0]
        if len(xs): cs.append((xs.min()+xs.max())/2)
    return float(np.median(cs))

for name,(x0,x1) in {'sain':(250,600),'seven_star':(960,1330)}.items():
    old=np.array(Image.open(D+name+'.png'))[...,3]>20
    ocx=blade_cx(old,300,600); ot,ob=axis_ends(old,ocx)
    c=cutout(sheet,(x0,0,x1,sheet.height)); A=np.array(c); a=A[...,3]>20
    ys=np.nonzero(a.any(1))[0]; h=ys.max()-ys.min()
    cx=blade_cx(a, ys.min()+int(h*0.25), ys.min()+int(h*0.6)); t,b=axis_ends(a,cx)
    s=(ob-ot)/(b-t)
    c2=c.resize((round(c.width*s),round(c.height*s)),Image.LANCZOS)
    can=Image.new('RGBA',(240,960)); can.alpha_composite(c2,(round(120-cx*s), round(ot-t*s)))
    C=np.array(can).astype(float)
    C[:,216:,3]*=np.linspace(1,0,24)[None,:]   # 잘리는 술 끝을 부드럽게
    out=Image.fromarray(C.astype(np.uint8)); out.save(D+name+'.png')
    na=np.array(out)[...,3]>20; ncx=blade_cx(na,300,600); hc=blade_cx(na,740,860)
    print(name,'scale',round(s,3),'blade cx',ncx,'handle cx',hc,'tip',axis_ends(na,ncx)[0],'old tip',ot,'left col alpha rows',int(na[:,0].sum()))
