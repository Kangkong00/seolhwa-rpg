# 무예 효과 그림 12장(Flow 136~138, 2026-10-22) → assets/fx/<id>.png
# 검은 배경 → 투명: alpha = 가장 밝은 채널(빛 효과라 검정 = 투명), 색은 alpha로 나눠 원래 밝기를 살림(더하기 섞기·보통 섞기 둘 다 됨)
# 시트마다 덩어리를 찾아(가까운 조각은 이어 붙임) 자리 순서로 id. 오른쪽 아래 Flow 반짝이는 지움.
import numpy as np
from PIL import Image
from scipy import ndimage
G='/home/claude/seolhwa-rpg/'; V=G+'assets/source/v3/'; OUT=G+'assets/fx/'
def cut(sheet, ids, order, grow=6, maxside=512):
    im=np.array(Image.open(V+sheet).convert('RGB')).astype(np.float32)
    im[640:715,1235:1325]=0                      # Flow 반짝이
    mx=im.max(2)
    fg=mx>18
    big=ndimage.binary_dilation(fg,iterations=grow)
    lab,n=ndimage.label(big); sz=ndimage.sum(fg,lab,range(1,n+1))
    keep=[i+1 for i,v in enumerate(sz) if v>0.04*sz.max()]
    boxes=[]
    for i in keep:
        ys,xs=np.nonzero((lab==i)&fg); boxes.append((order(xs.mean(),ys.mean()),i,ys.min(),ys.max(),xs.min(),xs.max()))
    assert len(boxes)==len(ids),(sheet,len(boxes))
    boxes.sort()
    out={}
    for (k,i,y0,y1,x0,x1),name in zip(boxes,ids):
        m=lab==i; pad=6
        y0,x0=max(0,y0-pad),max(0,x0-pad); y1,x1=min(im.shape[0],y1+pad+1),min(im.shape[1],x1+pad+1)
        rgb=im[y0:y1,x0:x1]*m[y0:y1,x0:x1,None]
        a=np.clip((rgb.max(2)-8)/200,0,1)**0.8     # 아주 어두운 잡티는 투명
        col=np.where(a[...,None]>0.01,np.clip(rgb/255/np.maximum(a[...,None],1e-3),0,1),0)
        img=Image.fromarray(np.dstack([(col*255).astype(np.uint8),(a*255).astype(np.uint8)]),'RGBA')
        s=min(1,maxside/max(img.size)) if maxside else 1
        # 원본(1376 시트) 그대로 쓰되 너무 크면 줄임 — 게임에서 키워 씀
        if s<1: img=img.resize((round(img.width*s),round(img.height*s)),Image.LANCZOS)
        img.save(OUT+name+'.png',optimize=True); out[name]=img.size
    return out
def cut_cols(sheet, ids, nominal, maxside=512):
    # 가로로 나란한 효과: 가운데쯤(±90)에서 가장 빈 세로줄로 나눔
    im=np.array(Image.open(V+sheet).convert('RGB')).astype(np.float32); im[640:715,1235:1325]=0
    col=(im.max(2)>18).sum(0)
    cuts=[0]+[int(np.arange(c-90,c+90)[np.argmin(col[c-90:c+90])]) for c in nominal]+[im.shape[1]]
    out={}
    for k,name in enumerate(ids):
        sub=im[:,cuts[k]:cuts[k+1]]; fg=sub.max(2)>18
        fg=ndimage.binary_opening(fg,iterations=1)
        lab,n=ndimage.label(ndimage.binary_dilation(fg,iterations=10)); sz=ndimage.sum(fg,lab,range(1,n+1))
        keep=np.isin(lab,[i+1 for i,v in enumerate(sz) if v>0.02*sz.max()])&(sub.max(2)>10)
        ys,xs=np.nonzero(keep); y0,y1,x0,x1=max(0,ys.min()-6),ys.max()+7,max(0,xs.min()-6),xs.max()+7
        rgb=sub[y0:y1,x0:x1]*keep[y0:y1,x0:x1,None]
        a=np.clip((rgb.max(2)-8)/200,0,1)**0.8
        colr=np.where(a[...,None]>0.01,np.clip(rgb/255/np.maximum(a[...,None],1e-3),0,1),0)
        img=Image.fromarray(np.dstack([(colr*255).astype(np.uint8),(a*255).astype(np.uint8)]),'RGBA')
        s=min(1,maxside/max(img.size))
        if s<1: img=img.resize((round(img.width*s),round(img.height*s)),Image.LANCZOS)
        img.save(OUT+name+'.png',optimize=True); out[name]=img.size
    return out
if __name__=='__main__':
    R={}
    lr=lambda x,y:x
    R.update(cut_cols('vfx_136_slash_sheet.jpg',['fx_slash_crescent','fx_slash_triple','fx_earth_crack','fx_wind_crescent'],[380,705,1015]))
    # 137: 왼쪽 회오리, 번개, 오른쪽 위 충격파 고리, 오른쪽 아래 질주 빛줄기
    R.update(cut('vfx_137_wind_sheet.jpg',['fx_whirl_ring','fx_lightning','fx_shock_ring','fx_dash_streak'],lambda x,y:(0 if x<400 else 1 if x<720 else (2 if y<400 else 3))))
    R.update(cut_cols('vfx_138_big_sheet.jpg',['fx_tiger_spirit','fx_star_burst','fx_gold_shield','fx_heal_swirl'],[438,762,1085]))
    print(R)
    # 미리보기: 어두운 땅 위에 더하기로
    W=200; P=Image.new('RGB',(W*6,W*2),(40,36,30))
    for k,(nm,_) in enumerate(R.items()):
        im=Image.open(OUT+nm+'.png'); im.thumbnail((W-10,W-10))
        bg=P.crop(((k%6)*W,(k//6)*W,(k%6)*W+W,(k//6)*W+W)).convert('RGBA'); bg.alpha_composite(im,((W-im.width)//2,(W-im.height)//2))
        P.paste(bg.convert('RGB'),((k%6)*W,(k//6)*W))
    P.save(G+'docs/vfx_preview.png')
