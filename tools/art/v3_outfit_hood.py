# 옷 2~6 무기 자세(2026-10-18) 머리 위치만 새로 재서 head_anchor.json·상투 지우개에 더함 (hood_align.py와 같은 계산)
import cv2, numpy as np, json, os, sys
sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from PIL import Image
G='/home/claude/seolhwa-rpg/'
R=G+'assets/characters/'
H=G+'assets/equipment/head/'
S=sys.argv[1]
def load(p):
    a=np.array(Image.open(p).convert('RGBA')).astype(np.float32); al=a[...,3:]/255
    return (a[...,:3]*al+255*(1-al)), a[...,3]
hoods={d:np.array(Image.open(H+f'hood_mumyeong/{d}.png').convert('RGBA')) for d in ['front','side','back']}
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
OUT=['outfit2_mumyeong','outfit3_dopo','outfit4_cheollik','outfit5_dujeonggap','outfit6_sinseon']
for outfit in OUT:
    for k in ['hold','hold_step','raise','swing','strike']:
        for d in ['front','side','back']:
            n=f'{d}_{k}'; hA=align(d,outfit,n); tiles.append((f'{outfit[7:]} {n}',wear(R+f'{outfit}/{n}.png',hA)))
anchor=json.load(open(H+'head_anchor.json'))
for key,v in res.items():
    anchor[key]={"from":[float(x) for x in v['from']],"to":v['to'],"rotDeg":v['rotDeg'],"scale":v['scale']}
    outfit,n=key.split('/'); m=MASKS[R+f'{outfit}/{n}.png']
    a=np.zeros(m.shape+(4,),np.uint8); a[m]=(255,255,255,255)
    Image.fromarray(a).save(H+f'hood_mumyeong/topknot/{outfit}/{n}.png',optimize=True)
json.dump(anchor,open(H+'head_anchor.json','w'),ensure_ascii=False,indent=1)
json.dump(res,open(S+'hood_align_outfits.json','w'),ensure_ascii=False,indent=1)
from PIL import ImageDraw
cols=15; T=[t[1].crop(((t[1].width-400)//2,0,(t[1].width+400)//2,360)) for t in tiles]
P=Image.new('RGB',(400*cols,380*((len(T)+cols-1)//cols)),'white'); D=ImageDraw.Draw(P)
for i,(t,(lab,_)) in enumerate(zip(T,tiles)): P.paste(t,((i%cols)*400,(i//cols)*380)); D.text(((i%cols)*400+5,(i//cols)*380+362),lab,fill='black')
P.resize((P.width//4,P.height//4)).save(S+'hood_outfits.png')
print(len(res),'aligned; max err',max(v['err'] for v in res.values()))
