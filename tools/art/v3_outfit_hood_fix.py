# 옷 2~6 옆면 치켜들기(무명옷·신선복): 치켜든 팔이 상투와 한 덩어리로 이어져 상투 지우개가 상투를 남김 (2026-10-18)
# → 두건 윗선 위, 두건 가로 범위 안의 '머리카락 색' 화소를 지우개에 더함(피부·옷은 남김).
import json, numpy as np, math
from PIL import Image
from scipy import ndimage
G='/home/claude/seolhwa-rpg/'; H=G+'assets/equipment/head/'
an=json.load(open(H+'head_anchor.json'))
def placed_hood(o,n,W=640,Hh=720):
    a=an[f'{o}/{n}']; hd=Image.open(H+'hood_mumyeong/'+n.split('_')[0]+'.png').convert('RGBA')
    big=Image.new('RGBA',(1400,1400)); fx,fy=a['from']; big.alpha_composite(hd,(int(700-fx),int(700-fy)))
    s=a['scale']; big=big.resize((round(1400*s),)*2).rotate(-a['rotDeg'],center=(700*s,700*s))
    L=Image.new('RGBA',(W,Hh)); tx,ty=a['to']; L.alpha_composite(big,(int(tx-700*s),int(ty-700*s))); return np.array(L)
for o,n in [('outfit2_mumyeong','side_raise'),('outfit6_sinseon','side_raise')]:
    b=np.array(Image.open(G+f'assets/characters/{o}/{n}.png').convert('RGBA')).astype(int)
    ha=placed_hood(o,n)[...,3]>40; cols=np.where(ha.any(0))[0]; lo,hi=cols.min(),cols.max()
    top=np.full(b.shape[1],-1)
    for x in cols: top[x]=np.argmax(ha[:,x])
    yy,xx=np.mgrid[:b.shape[0],:b.shape[1]]
    above=(top[xx]>0)&(yy<=top[xx]+6)
    r,g,bb,al=b[...,0],b[...,1],b[...,2],b[...,3]
    hair=(al>20)&(r>45)&(r<190)&(r>g)&(g>bb)&(r-bb>35)&(r-g>12)&~((r>185)&(bb>=0.6*r))
    # 상투는 치켜든 주먹보다 뒤(오른쪽)에 있음 → 두건 윗선 위에서 주먹·팔(피부·소매)의 오른쪽 끝보다 오른쪽은 모두 지움
    skin=(al>200)&(r>185)&(r-bb>30)&(r-g>25)
    lab,nl=ndimage.label(skin&above); armx=0
    for i in range(1,nl+1):
        xs=np.nonzero(lab==i)[1]
        if len(xs)>300: armx=max(armx,xs.max())
    add=above&(al>0)&(xx>armx+3)
    add|=ndimage.binary_dilation(above&hair,iterations=1)&(al>20)&above
    p=H+f'hood_mumyeong/topknot/{o}/{n}.png'; m=np.array(Image.open(p).convert('RGBA'))[...,3]>0
    m|=add
    rest=(al>20)&~m; l2,n2=ndimage.label(rest)
    if n2>1:
        sz=ndimage.sum(rest,l2,range(1,n2+1)); big=sz.max()
        for i,sv in enumerate(sz,1):
            if sv<0.01*big: m|=(l2==i)      # 지우고 남은 떠 있는 조각(머리카락 끝)
    out=np.zeros(m.shape+(4,),np.uint8); out[m]=(255,255,255,255); Image.fromarray(out).save(p,optimize=True)
    print(o,n,int(add.sum()),'px added')
