import sys; sys.path.insert(0,'.')
from cut2 import cutout
from PIL import Image, ImageOps
import numpy as np, os
from scipy import ndimage
U='/root/.claude/uploads/be5b45b3-e0a4-5e3d-966b-87fd9240d272/'
D='/home/claude/seolhwa-rpg/assets/monsters/bigrat'
def comps(f,n=3):
    im=Image.open(U+f).convert('RGB'); a=np.array(im); m=a.min(axis=2)<230
    m=ndimage.binary_closing(m,iterations=3); lab,k=ndimage.label(m)
    sz=ndimage.sum(m,lab,range(1,k+1)); idx=np.argsort(sz)[::-1][:n]+1
    out=[]
    for i in idx:
        mk=ndimage.binary_dilation(lab==i,iterations=4); ys,xs=np.where(mk)
        sub=a.copy(); sub[~mk]=255
        tmp=Image.fromarray(sub); c=cutout(tmp,(xs.min(),ys.min(),xs.max()+1,ys.max()+1)); out.append((xs.min(),c))
    return [c for _,c in sorted(out,key=lambda t:t[0])]
CW,CH,BASE,TH=640,400,380,240
def place(c,s):
    c=c.resize((round(c.width*s),round(c.height*s)),Image.LANCZOS)
    can=Image.new('RGBA',(CW,CH),(0,0,0,0)); can.alpha_composite(c,((CW-c.width)//2,BASE-c.height)); return can
scale=None
for f,names in [('547e3534-image.webp',['front','side','back']),('3e1d0ed8-image.webp',['front_step','side_step','back_step'])]:
    figs=comps(f)
    if scale is None: scale=TH/figs[0].height

    for nm,c in zip(names,figs):
        p=place(c,scale); p.save(f'{D}/{nm}.png'); print(nm,c.size,p.getbbox())
