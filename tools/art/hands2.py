from PIL import Image
import numpy as np
from scipy import ndimage
R='/home/claude/seolhwa-rpg/assets/characters/outfit1_hotot/'
est={'front_swing':(184,210),'side_swing':(116,224),'back_swing':(456,210),
'front_hold':(200,420),'side_hold':(200,414),'back_hold':(436,414),
'front_hold_step':(224,424),'side_hold_step':(210,420),'back_hold_step':(450,386),
'front_raise':(151,161),'side_raise':(214,143),'back_raise':(484,166),
'front_strike':(349,470),'side_strike':(216,467),'back_strike':(427,397)}
res={}
for n,(x,y) in est.items():
    a=np.array(Image.open(R+n+'.png')); A=a.astype(int)
    r,g,b,al=A[...,0],A[...,1],A[...,2],A[...,3]
    skin=(al>200)&(r>185)&(r-b>30)&(r-b<115)&(g>130)
    yy,xx=np.mgrid[:720,:640]; near=((xx-x)**2+(yy-y)**2)<34**2
    m=skin&near; lab,nl=ndimage.label(m)
    if nl==0: print('NO',n); continue
    sizes=ndimage.sum(m,lab,range(1,nl+1)); k=np.argmax(sizes)+1; comp=lab==k
    comp=ndimage.binary_closing(comp,iterations=3)
    comp=ndimage.binary_dilation(comp,iterations=4)&(al>0)&near
    ys,xs=np.nonzero(comp); cx,cy=int(xs.mean()),int(ys.mean()); res[n]=(cx,cy)
    o=a.copy(); o[...,3]=np.where(comp,a[...,3],0)
    Image.fromarray(o).save(R+n+'_hand.png')
print(res)

