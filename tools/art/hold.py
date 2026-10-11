import sys; sys.path.insert(0,'.')
from cut2 import cutout
from punch import segs, bodyx, W
from PIL import Image
import numpy as np, shutil
U='/root/.claude/uploads/be5b45b3-e0a4-5e3d-966b-87fd9240d272/'
S='/home/claude/seolhwa-rpg/assets/source/'
R='/home/claude/seolhwa-rpg/assets/characters/outfit1_hotot/'
for f,kind in [('d488cc1d','hold'),('6d9735a4','hold_step')]:
    shutil.copy(U+f+'-image.jpg',S+f'outfit1_hotot_{kind}.jpg')
    im=Image.open(U+f+'-image.jpg').convert('RGB'); ss=segs(im); print(kind,ss)
    fs=[cutout(im,(max(0,s-10),0,min(im.width,e+10),im.height)) for s,e in ss[:3]]
    s=640/fs[0].height
    for n,c in zip(['front','side','back'],fs):
        c2=c.resize((round(c.width*s),round(c.height*s)),Image.LANCZOS); bx=bodyx(c2)
        can=Image.new('RGBA',(W,720)); can.alpha_composite(c2,(round(W/2-bx),700-c2.height))
        can.save(R+f'{n}_{kind}.png'); print(' ',n,can.getbbox())
