import sys; sys.path.insert(0,'.')
KINDS=[('321661cb','swing')]
from cut2 import cutout
from punch import segs, bodyx, W
from PIL import Image
import numpy as np, shutil
U='/root/.claude/uploads/be5b45b3-e0a4-5e3d-966b-87fd9240d272/'
S='/home/claude/seolhwa-rpg/assets/source/'
R='/home/claude/seolhwa-rpg/assets/characters/outfit1_hotot/'
def centertop(c):
    a=np.array(c)[...,3]>128; bx=bodyx(c); x0=int(bx-25); x1=int(bx+25)
    ys=np.nonzero(a[:,x0:x1].any(1))[0]; return ys.min()
for f,kind in KINDS:
    shutil.copy(U+f+'-image.jpg',S+f'outfit1_hotot_{kind}.jpg')
    im=Image.open(U+f+'-image.jpg').convert('RGB'); ss=segs(im); print(kind,ss)
    fs=[cutout(im,(max(0,s-10),0,min(im.width,e+10),im.height)) for s,e in ss[:3]]
    back=fs[2]; h=back.height-centertop(back); s=640/h; print(' scale',s,'backh',h)
    for n,c in zip(['front','side','back'],fs):
        c2=c.resize((round(c.width*s),round(c.height*s)),Image.LANCZOS); bx=bodyx(c2)
        can=Image.new('RGBA',(W,720)); can.alpha_composite(c2,(round(W/2-bx),700-c2.height))
        can.save(R+f'{n}_{kind}.png'); print(' ',n,can.getbbox())
