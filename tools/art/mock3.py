from mock2 import comp, SW
from swing3d import *
F={'front':[(150,160),(184,210),(360,464)],'side':[(214,136),(116,224),(210,480)],'back':[(480,160),(456,210),(430,390)]}
N={'front':['front_raise','front_swing','front_strike'],'side':['side_raise','side_swing','side_strike'],'back':['back_raise','back_swing','back_strike']}
LUNGE={'front':(0,6),'side':(-10,0),'back':(0,-6)}
def stage(th): return 0 if th<5 else (1 if th<80 else 2)
frames=[]
us=[0,0,0.12,0.25,0.35,0.45,0.55,0.65,0.75,0.88,1,1,1]
for u in us:
    row=Image.new('RGBA',(640*3,720),BG)
    for i,v in enumerate(['front','side','back']):
        p=SW[v]; th=p['t0']+(p['t1']-p['t0'])*u; k=stage(th)
        x,y=F[v][k]; t=comp(N[v][k],x,y,v,th,p['lat'])
        lx,ly=LUNGE[v]; f=min(1,max(0,(u-0.3)/0.5))
        t2=Image.new('RGBA',(640,720),BG); t2.alpha_composite(t,(round(lx*f),round(ly*f)))
        row.alpha_composite(t2,(i*640,0))
    frames.append(row.convert('RGB').resize((960,360)))
frames[0].save('swing3f.gif',save_all=True,append_images=frames[1:],duration=[300,300]+[70]*8+[500,500,500],loop=0)
s=Image.new('RGB',(960,360*len(frames)))
for i,f in enumerate(frames): s.paste(f,(0,i*360))
s.resize((480,180*len(frames))).save('swing3f_strip.png')
