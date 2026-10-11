from slash import *
import numpy as np
def sickle(size,cx,cy,a0,a1,R,band,color,ey=0.82,amax=0.95,peak=0.68,tail=0.5):
    W,H=size; yy,xx=np.mgrid[:H,:W]
    dx=xx-cx; dy=(yy-cy)/ey; r=np.hypot(dx,dy); ang=np.degrees(np.arctan2(dy,dx))
    t=(a0-ang)%360/abs(a0-a1); inside=(t>=0)&(t<=1); tc=np.clip(t,0,1)
    # 두께: 양 끝 뾰족, 가장 두꺼운 곳은 칼 쪽(peak)
    prof=np.where(tc<peak, np.sin(np.pi/2*tc/peak), np.cos(np.pi/2*(tc-peak)/(1-peak)))**1.1
    th=band*prof; r_in=R-th
    rad=np.clip((r-r_in)/np.maximum(th,1),0,1)                 # 안 0 → 바깥 1
    outer=np.clip((R-r)/1.2+0.5,0,1)                           # 바깥 테두리 또렷하게
    innerE=np.clip((r-r_in)/6+0.5,0,1)
    a=amax*(rad**1.2)*outer*innerE
    a*=np.clip(tc/tail,0,1)**1.4                               # 꼬리는 길게 흐려짐
    a=np.where(inside,a,0)
    # 바깥 테두리는 칼날 색보다 밝게(빛나는 날)
    base=np.array(color[:3],float); hi=base+(255-base)*0.55
    mix=(rad**6)[...,None]
    rgb=(base*(1-mix)+hi*mix).astype('uint8')
    out=np.dstack([rgb,(np.clip(a,0,1)*255).astype('uint8')])
    return Image.fromarray(out,'RGBA')
tr4=sickle(SZ,215+PAD[0],350+PAD[1],-80,-232,400,250,COL,peak=0.6)
res4=[]
for tr in (tr_new,tr4):
    t=Image.new('RGBA',SZ,BG); t.alpha_composite(place(fg)); t.alpha_composite(tr); res4.append(t.crop((0,0,1000,1200)))
s=Image.new('RGB',(2000,1200))
for i,t in enumerate(res4): s.paste(t.convert('RGB'),(i*1000,0))
s.resize((1000,600)).save('sickle_compare.png')
g=res4[1].resize((round(1000*62/640),round(1200*62/640)),Image.LANCZOS)
g.convert('RGB').resize((g.width*3,g.height*3),Image.NEAREST).save('sickle_gamesize.png')
