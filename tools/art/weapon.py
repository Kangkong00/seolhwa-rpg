import sys; sys.path.insert(0,'.')
from cut2 import cutout
from PIL import Image
import numpy as np, shutil, json, os
U='/root/.claude/uploads/be5b45b3-e0a4-5e3d-966b-87fd9240d272/'
S='/home/claude/seolhwa-rpg/assets/source/'
A='/home/claude/seolhwa-rpg/assets/weapons/'
os.makedirs(A,exist_ok=True)
def proc(f,name,length,grip_frac,out=True):
    im=Image.open(U+f).convert('RGB'); im.save(S+'weapon_'+name+'.png')
    c=cutout(im,(0,0,im.width,im.height))
    a=np.array(c)[...,3]>128; ys,xs=np.nonzero(a)
    # tilt: fit x as function of y
    k=np.polyfit(ys,xs,1)[0]; ang=np.degrees(np.arctan(k))
    print(name,'tilt deg',round(ang,2),'size',c.size)
    if abs(ang)>0.3: c=c.rotate(-ang,resample=Image.BICUBIC,expand=True); c=c.crop(c.getbbox())
    s=length/c.height; c=c.resize((round(c.width*s),length),Image.LANCZOS)
    gy=round(length*(1-grip_frac))  # grip y within weapon
    can=Image.new('RGBA',(240,960)); can.alpha_composite(c,(120-c.width//2,800-gy))
    if out: can.save(A+name+'.png')
    return can
proc('3262ca20-image.webp','wood_pine',480,0.125)
proc('71d8631e-image.webp','wood_oak',480,0.13,out=False).save('wood_oak_preview.png')
proc('5067fc35-image.webp','wood_bakdal',480,0.13,out=False).save('wood_bakdal_preview.png')
