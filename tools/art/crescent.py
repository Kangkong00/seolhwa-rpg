from trail import *
import numpy as np, math
from PIL import ImageFilter
def crescent(size,cx,cy,a0,a1,r_out,band,color,amax=0.9,fade=0.22):
    W,H=size; yy,xx=np.mgrid[:H,:W]
    dx=xx-cx; dy=yy-cy; r=np.hypot(dx,dy); ang=np.degrees(np.arctan2(dy,dx))
    # 진행도 t: a0 → a1 (각도 감소 방향)
    t=(a0-ang)%360/abs(a0-a1)
    inside=(t>=0)&(t<=1)
    th=band*np.sin(np.pi*np.clip(t,0,1))**0.7          # 가운데 두껍고 양끝 가늘게(초승달)
    r_in=r_out-th
    radial=np.clip((r-r_in)/np.maximum(th,1),0,1)        # 안쪽 0 → 바깥 1
    edge=np.clip((r_out-r)/3+0.5,0,1)*np.clip((r-r_in)/3+0.5,0,1)
    a=amax*(0.15+0.85*radial**1.5)*edge
    a*=np.clip(np.minimum(t/fade,(1-t)/fade),0,1)        # 처음·끝 그라데이션
    a=np.where(inside,a,0)
    c=Image.new('RGBA',size,color); al=Image.fromarray((np.clip(a,0,1)*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.5))
    c.putalpha(al); return c
cx,cy=220+PAD[0],360+PAD[1]
tr_new=crescent(SZ,cx,cy,-65,-233,380,185,COL)
tr_old=stroke(SZ,side_pts(),COL,48)
out=[]
for tr in (tr_old,tr_new):
    b=place(Image.open(R+'side_strike.png')); t=Image.new('RGBA',SZ,BG); t.alpha_composite(b); t.alpha_composite(tr); out.append(t.crop((0,0,1000,1200)))
s=Image.new('RGB',(2000,1200))
for i,t in enumerate(out): s.paste(t.convert('RGB'),(i*1000,0))
s.resize((1000,600)).save('side_trail_compare.png')
# 게임 크기 미리보기 (캐릭터 62px)
g=out[1].resize((round(900*62/640),round(1000*62/640)),Image.LANCZOS)
g2=Image.new('RGB',(g.width*3,g.height*3)); g2.paste(g.convert('RGB').resize((g.width*3,g.height*3),Image.NEAREST))
g2.save('side_trail_gamesize.png')
import mock2
full=mock2.comp('side_strike',210,480,'side',125,0)  # 640x720 with BG
fg=Image.new('RGBA',(640,720)); 
body=Image.open(R+'side_strike.png'); sx,sy,b=projc('side',125,0); wl=draw_weapon(210,480,sx,sy)
fg.alpha_composite(body); fg.alpha_composite(wl); fg.alpha_composite(Image.open(R+'side_strike_hand.png'))
res=[]
for tr in (tr_old,tr_new):
    t=Image.new('RGBA',SZ,BG); t.alpha_composite(place(fg)); t.alpha_composite(tr); res.append(t.crop((0,0,1000,1200)))
s=Image.new('RGB',(2000,1200))
for i,t in enumerate(res): s.paste(t.convert('RGB'),(i*1000,0))
s.resize((1000,600)).save('side_trail_compare.png')
g=res[1].resize((round(1000*62/640),round(1200*62/640)),Image.LANCZOS)
g.convert('RGB').resize((g.width*3,g.height*3),Image.NEAREST).save('side_trail_gamesize.png')
