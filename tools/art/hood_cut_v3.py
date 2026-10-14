# 새 그림체(v3) 두건 오리기. 두건 시트와 홑옷 3방향 시트는 인물 위치가 픽셀 단위로 같음 →
# 두 그림의 색 차이(피부 제외) 중 머리 쪽 두건 천과 이어진 부분만 두건으로 봄.
# 결과는 홑옷 서 있기(v3_chars.py)와 똑같은 변환(홑옷 그림의 테두리 상자 → 640/키 배 → 400×720, 발 700)으로 놓음.
# 출력: 작업 폴더 hood2_{front,side,back}.png → hood_align.py → hood_export.py
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from punch import segs
from PIL import Image
import numpy as np
from scipy import ndimage
from scipy.ndimage import gaussian_filter
S='/tmp/claude-0/-home-claude-seolhwa-rpg/1798b720-9bbd-5e1d-af87-0516171baaa5/scratchpad/'
V='/home/claude/seolhwa-rpg/assets/source/v3/'
hood=Image.open(V+'head_hood_mumyeong_sheet.jpg').convert('RGB')
body=Image.open(V+'outfit1_turnaround.jpg').convert('RGB')
bss=segs(body); print('body segs',bss,'hood segs',segs(hood))
a=np.array(hood).astype(float); o=np.array(body).astype(float)
dif=np.sqrt(((gaussian_filter(a,(1.2,1.2,0))-gaussian_filter(o,(1.2,1.2,0)))**2).sum(2))>40
r,g,b=a[...,0],a[...,1],a[...,2]
skin=(r>190)&(b>=0.62*r)&(g<0.93*r)
cloth=(b<0.62*r)&(r>110)&(g>0.72*r)        # 누런 천(두건과 저고리 모두 해당 — 그래서 색 차이와 같이 씀)
fg=a.min(2)<232
figs=[cutout(body,(max(0,s-10),0,min(body.width,e+10),body.height)) for s,e in bss[:3]]
sc=640/figs[0].height
for name,(x0,x1),fig in zip(['front','side','back'],bss[:3],figs):
    reg=np.zeros(dif.shape,bool); reg[:430,max(0,x0-30):x1+30]=True
    m=dif&fg&~skin&reg
    m=ndimage.binary_opening(m,iterations=1)
    seed=m&cloth; seed[260:]=False                     # 머리 높이의 천에서 시작
    lab,n=ndimage.label(ndimage.binary_closing(m,iterations=2))
    sz=ndimage.sum(seed,lab,range(1,n+1)); keep=[i+1 for i,v in enumerate(sz) if v>800]
    m=np.isin(lab,keep)
    m=ndimage.binary_closing(m,iterations=3)
    m=ndimage.binary_dilation(m,iterations=2)&fg&~skin&reg
    filled=ndimage.binary_fill_holes(m); holes=filled&~m
    hl,hn=ndimage.label(holes)
    for i in range(1,hn+1):
        if (hl==i).sum()<3000: m|=(hl==i)
    # 홑옷 그림이 오려진 상자와 같은 자리로 자름
    bx=(max(0,x0-10),0,min(body.width,x1+10),body.height)
    full=cutout(body,bx)          # 크기만 필요
    crop=np.array(body.crop(bx)).astype(int)
    # cutout 의 잘린 자리 = 알파 테두리 → 홑옷 그림의 위·왼쪽 첫 전경 위치를 같은 방식으로 찾음
    ys=np.where((crop.min(2)<=225).any(1))[0]; xs=np.where((crop.min(2)<=225).any(0))[0]
    oy,ox=ys[0],xs[0]
    # 1px 여유(흐림 알파) 보정: cutout 크기와 맞춤
    dy=max(0,(full.height-(ys[-1]-ys[0]+1))//2); dx=max(0,(full.width-(xs[-1]-xs[0]+1))//2)
    oy-=dy; ox-=dx
    mk=m[:,bx[0]:bx[2]][oy:oy+full.height,ox:ox+full.width]
    hc=np.array(hood.crop(bx).convert('RGBA'))[oy:oy+full.height,ox:ox+full.width].copy()
    hc[...,3]=(255*gaussian_filter(mk.astype(float),0.7)).clip(0,255).astype(np.uint8)
    hi=Image.fromarray(hc).resize((round(full.width*sc),round(full.height*sc)),Image.LANCZOS)
    can=Image.new('RGBA',(400,720)); can.alpha_composite(hi,((400-hi.width)//2,700-hi.height))
    can.save(S+f'hood2_{name}.png'); print(name,'offset',(oy,ox),'cut size',full.size)
