from swing3d import *
import numpy as np, math
from PIL import ImageFilter
R2=R
def stroke(size,pts,color,wmax,fade=0.22,amax=0.85):
    W,H=size; lay=np.zeros((H,W),float)
    n=len(pts); yy,xx=np.mgrid[:H,:W]
    for i,(x,y) in enumerate(pts):
        t=i/(n-1)
        w=wmax*(0.35+0.65*math.sin(math.pi*min(1,max(0,t*0.9+0.05))))  # 붓: 가운데 굵게
        a=amax*min(1,t/fade,(1-t)/fade)                                  # 처음·끝 그라데이션
        r=w/2; x0,x1=int(max(0,x-r-2)),int(min(W,x+r+2)); y0,y1=int(max(0,y-r-2)),int(min(H,y+r+2))
        if x0>=x1 or y0>=y1: continue
        d=np.hypot(xx[y0:y1,x0:x1]-x,yy[y0:y1,x0:x1]-y)
        v=np.clip((r-d)/3+0.5,0,1)*a
        lay[y0:y1,x0:x1]=np.maximum(lay[y0:y1,x0:x1],v)
    c=Image.new('RGBA',size,color); al=Image.fromarray((lay*255).astype('uint8')).filter(ImageFilter.GaussianBlur(2))
    c.putalpha(al); return c
PAD=(300,400)  # 바깥 여백(왼,위)
SZ=(640+600,720+500)
def place(img): c=Image.new('RGBA',SZ); c.alpha_composite(img,PAD); return c
def side_pts():
    cx,cy=275+PAD[0],320+PAD[1]; Rr=340
    a0=math.radians(-55); a1=math.radians(-225)  # 머리 뒤(오른쪽 위) → 위 → 앞(왼쪽) → 앞 아래
    return [(cx+Rr*math.cos(a0+(a1-a0)*k/80), cy+Rr*math.sin(a0+(a1-a0)*k/80)) for k in range(81)]
def line_pts(p0,p1): return [(PAD[0]+p0[0]+(p1[0]-p0[0])*k/80, PAD[1]+p0[1]+(p1[1]-p0[1])*k/80) for k in range(81)]
COL=(0xe4,0xcb,0x97,255)
out=[]
for v,body,pts,behind in [('side','side_strike',side_pts(),False),
                          ('front','front_strike',line_pts((180,-10),(430,600)),False),
                          ('back','back_strike',line_pts((470,-60),(370,470)),True)]:
    b=place(Image.open(R2+body+'.png')); tr=stroke(SZ,pts,COL,48)
    t=Image.new('RGBA',SZ,BG)
    if behind: t.alpha_composite(tr); t.alpha_composite(b)
    else: t.alpha_composite(b); t.alpha_composite(tr)
    out.append(t)
s=Image.new('RGB',(SZ[0]*3,SZ[1]))
for i,t in enumerate(out): s.paste(t.convert('RGB'),(i*SZ[0],0))
s.resize((SZ[0]*3//4,SZ[1]//4)).save('trail_mock.png')
