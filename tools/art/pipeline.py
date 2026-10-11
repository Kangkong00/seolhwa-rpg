import sys; sys.path.insert(0,'.')
from cut2 import cutout
from PIL import Image, ImageOps
import numpy as np
from scipy import ndimage
U='/root/.claude/uploads/be5b45b3-e0a4-5e3d-966b-87fd9240d272/'
R='/home/claude/seolhwa-rpg/assets/characters/'
def segs(f):
    im=Image.open(U+f); a=np.array(im.convert('RGB')); m=a.min(axis=2)<225
    m=ndimage.binary_opening(m,iterations=1); col=m.sum(0)>2; out=[]; x=0; W=len(col)
    while x<W:
        if col[x]:
            s=x
            while x<W and (col[x] or col[x:x+15].any()): x+=1
            if x-s>60: out.append((s,x))
        x+=1
    return im,out
def fig(im,s,e): return cutout(im,(max(0,s-10),0,min(im.width,e+10),im.height))
def place(c,s):
    c=c.resize((round(c.width*s),round(c.height*s)),Image.LANCZOS)
    can=Image.new('RGBA',(400,720),(0,0,0,0)); can.alpha_composite(c,((400-c.width)//2,700-c.height)); return can
cfg={ # dir: (turn file, (front,side,back), sideMirror, walk file, (f,s,b), walkSideMirror)
'outfit1_hotot':('9c9ac153-image.webp',(0,1,2),False,'b9626d07-image.jpg',(0,1,2),False),
'outfit2_mumyeong':('7f0907a7-image.jpg',(0,2,3),False,'ee8b177f-image.jpg',(0,1,2),False),
'outfit3_dopo':('af89c1d9-image.jpg',(0,1,3),False,'6972f5dd-image.jpg',(0,1,3),False),
'outfit4_cheollik':('cf34df1c-image.jpg',(0,2,3),False,'5ea91b94-image.jpg',(0,2,3),False),
'outfit5_dujeonggap':('26855ba4-image.jpg',(0,1,2),False,'398211a0-image.jpg',(0,1,2),False),
'outfit6_sinseon':('2d2f5963-image.jpg',(0,1,2),True,'7f9a28a4-image.jpg',(0,1,3),True)}
for d,(tf,ti,tm,wf,wi,wm) in cfg.items():
    im,ss=segs(tf); fs=[fig(im,*ss[i]) for i in ti]
    s=640/fs[0].height
    if tm: fs[1]=ImageOps.mirror(fs[1])
    for n,c in zip(['front','side','back'],fs): place(c,s).save(R+d+f'/{n}.png')
    im,ss=segs(wf); ws=[fig(im,*ss[i]) for i in wi]
    s2=640/ws[0].height*(fs[0].height/fs[0].height)
    s2=s*(1.0) if abs(ws[0].height-fs[0].height)/fs[0].height<0.005 else 640/ws[0].height
    if wm: ws[1]=ImageOps.mirror(ws[1])
    for n,c in zip(['front_step','side_step','back_step'],ws): place(c,s2).save(R+d+f'/{n}.png')
    print(d,len(ss),'ok')
