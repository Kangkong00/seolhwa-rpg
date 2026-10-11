from crescent import *
def slash(size,cx,cy,a0,a1,R,band,color,amax=0.92,grow=0.22,tail=0.45,streaks=True):
    W,H=size; yy,xx=np.mgrid[:H,:W]
    dx=xx-cx; dy=yy-cy; r=np.hypot(dx,dy); ang=np.degrees(np.arctan2(dy,dx))
    t=(a0-ang)%360/abs(a0-a1); inside=(t>=0)&(t<=1); tc=np.clip(t,0,1)
    r_out=R*(1-grow+grow*tc)                 # 나선: 끝으로 갈수록 바깥으로 (덜 둥글게)
    th=band*np.clip(tc,0,1)**1.3             # 꼬리는 가늘고 칼 쪽으로 갈수록 두껍게
    r_in=r_out-th
    rad=np.clip((r-r_in)/np.maximum(th,1),0,1)
    edge=np.clip((r_out-r)/2+0.5,0,1)*np.clip((r-r_in)/4+0.5,0,1)
    a=amax*(0.1+0.9*rad**2)*edge
    if streaks:                               # 칼이 쓸고 간 결(붓결)
        a*=0.8+0.2*np.cos(rad*np.pi*7)**2
    a*=np.clip(tc/tail,0,1)**1.5              # 꼬리 쪽 그라데이션 (길게)
    a*=np.clip((1-tc)/0.04,0,1)               # 칼 쪽 끝은 칼날 선에서 짧게 끊김
    a=np.where(inside,a,0)
    c=Image.new('RGBA',size,color); al=Image.fromarray((np.clip(a,0,1)*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2))
    c.putalpha(al); return c
tr2=slash(SZ,220+PAD[0],360+PAD[1],-75,-233,380,200,COL)
res2=[]
for tr in (tr_new,tr2):
    t=Image.new('RGBA',SZ,BG); t.alpha_composite(place(fg)); t.alpha_composite(tr); res2.append(t.crop((0,0,1000,1200)))
s=Image.new('RGB',(2000,1200))
for i,t in enumerate(res2): s.paste(t.convert('RGB'),(i*1000,0))
s.resize((1000,600)).save('slash_compare.png')
g=res2[1].resize((round(1000*62/640),round(1200*62/640)),Image.LANCZOS)
g.convert('RGB').resize((g.width*3,g.height*3),Image.NEAREST).save('slash_gamesize.png')
