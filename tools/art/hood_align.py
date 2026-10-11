# 머리 위치 자동 맞추기: 서 있기 머리를 각 자세 그림에서 찾음(회전 -24~24도, 크기 0.88~1.12, 마스크 SQDIFF) -> hood_align.json + 상투 지우개 + 시안
import cv2, numpy as np, json, glob, os
from PIL import Image
S='/tmp/claude-0/-home-claude-seolhwa-rpg/1798b720-9bbd-5e1d-af87-0516171baaa5/scratchpad/'
R='/home/claude/seolhwa-rpg/assets/characters/'
def load(p):
    a=np.array(Image.open(p).convert('RGBA')).astype(np.float32); al=a[...,3:]/255
    return (a[...,:3]*al+255*(1-al)), a[...,3]
hoods={d:np.array(Image.open(S+f'hood2_{d}.png')) for d in ['front','side','back']}
res={}
def align(d,outfit,pose):
    srgb,sal=load(R+f'{outfit}/{d}.png'); prgb,pal=load(R+f'{outfit}/{pose}.png')
    hood=hoods[d]; ha=hood[...,3]>0
    ys=np.where(sal.max(1)>0)[0]; t=ys[0]; hb=t+230
    hy,hx=np.where(ha); 
    x0=max(0,min(hx.min(),np.where(sal[t:hb].max(0)>0)[0].min())-30); x1=min(400,max(hx.max(),np.where(sal[t:hb].max(0)>0)[0].max())+30)
    y0=max(0,t-30); y1=min(720,max(hy.max(),hb)+30)
    crop=srgb[y0:y1,x0:x1]; mask=np.zeros((y1-y0,x1-x0),np.float32); mask[:hb-y0]=(sal[y0:hb,x0:x1]>128)
    hc=hood[y0:y1,x0:x1].astype(np.float32)
    h,w=mask.shape; c=(w/2,h/2)
    best=None
    for ang in np.arange(-24,24.1,3):
        for sc in np.arange(0.88,1.13,0.04):
            M=cv2.getRotationMatrix2D(c,ang,sc)
            tm=cv2.warpAffine(crop,M,(w,h),borderValue=(255,255,255)); mm=cv2.warpAffine(mask,M,(w,h))
            if tm.shape[0]>prgb.shape[0] or tm.shape[1]>prgb.shape[1]: continue
            r=cv2.matchTemplate(prgb.astype(np.float32),tm.astype(np.float32),cv2.TM_SQDIFF,mask=np.dstack([mm]*3))
            r=r/ max(mm.sum(),1)
            mn,_,loc,_=cv2.minMaxLoc(r)
            if best is None or mn<best[0]: best=(mn,ang,sc,loc,M)
    # refine
    mn,ang0,sc0,loc,M=best
    for ang in np.arange(ang0-2,ang0+2.1,1):
        for sc in np.arange(sc0-0.03,sc0+0.031,0.01):
            M=cv2.getRotationMatrix2D(c,ang,sc)
            tm=cv2.warpAffine(crop,M,(w,h),borderValue=(255,255,255)); mm=cv2.warpAffine(mask,M,(w,h))
            r=cv2.matchTemplate(prgb.astype(np.float32),tm.astype(np.float32),cv2.TM_SQDIFF,mask=np.dstack([mm]*3))/max(mm.sum(),1)
            m2,_,l2,_=cv2.minMaxLoc(r)
            if m2<best[0]: best=(m2,ang,sc,l2,M)
    mn,ang,sc,loc,M=best
    hw=cv2.warpAffine(hc,M,(w,h))
    out=np.zeros((prgb.shape[0],prgb.shape[1],4),np.float32)
    X,Y=loc; xa,ya=max(0,X),max(0,Y); xb,yb=min(out.shape[1],X+w),min(out.shape[0],Y+h)
    out[ya:yb,xa:xb]=hw[ya-Y:yb-Y,xa-X:xb-X]
    # pivot: standing point c+(x0,y0) -> pose point (X+w/2, Y+h/2)
    res[f'{outfit}/{pose}']={'from':[round(x0+c[0],1),round(y0+c[1],1)],'to':[round(X+c[0],1),round(Y+c[1],1)],'rotDeg':round(-float(ang),1),'scale':round(float(sc),3),'err':round(float(mn),1)}
    return out.clip(0,255).astype(np.uint8)
from topknot import topknot_mask
MASKS={}
def wear(bodyp,hoodA):
    b=np.array(Image.open(bodyp).convert('RGBA')); m=topknot_mask(b,hoodA); MASKS[bodyp]=m
    b[m,3]=0
    im=Image.fromarray(b); im.alpha_composite(Image.fromarray(hoodA))
    bg=Image.new('RGBA',im.size,(255,255,255,255)); bg.alpha_composite(im); return bg.convert('RGB')
tiles=[]
for outfit in sorted(os.listdir(R)):
    for f in sorted(os.listdir(R+outfit)):
        n=f[:-4]
        if n.endswith('_hand') or n.endswith('_topknot'): continue
        d=n.split('_')[0]
        if n in ('front','side','back','front_step','side_step','back_step'): hA=hoods[d]
        else: hA=align(d,outfit,n)
        hA_img=hA; Image.fromarray(hA).save(S+f'hp_{outfit}_{n}.png')
        tiles.append((f'{outfit[7:]} {n}',wear(R+f'{outfit}/{f}',hA)))
json.dump(res,open(S+'hood_align.json','w'),ensure_ascii=False,indent=1)
from PIL import ImageDraw
cols=6; T=[t[1].crop(((t[1].width-400)//2,0,(t[1].width+400)//2,360)) for t in tiles]
P=Image.new('RGB',(400*cols,380*((len(T)+cols-1)//cols)),'white'); D=ImageDraw.Draw(P)
for i,(t,(lab,_)) in enumerate(zip(T,tiles)): P.paste(t,((i%cols)*400,(i//cols)*380)); D.text(((i%cols)*400+5,(i//cols)*380+362),lab,fill='black')
P.resize((P.width//2,P.height//2)).save(S+'hood_attack.png')
import pickle; pickle.dump({k:v for k,v in MASKS.items()},open(S+'masks.pkl','wb'))
print(len(tiles),'tiles')
