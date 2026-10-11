import sys; sys.path.insert(0,'.')
from cut2 import cutout
from PIL import Image, ImageOps
import numpy as np, shutil
from scipy import ndimage
U='/root/.claude/uploads/be5b45b3-e0a4-5e3d-966b-87fd9240d272/'
R='/home/claude/seolhwa-rpg/assets/characters/'
S='/home/claude/seolhwa-rpg/assets/source/'
def segs(im):
    a=np.array(im.convert('RGB')); m=a.min(axis=2)<225
    m=ndimage.binary_opening(m,iterations=1); col=m.sum(0)>2; out=[]; x=0; W=len(col)
    while x<W:
        if col[x]:
            s=x
            while x<W and (col[x] or col[x:x+15].any()): x+=1
            if x-s>60: out.append((s,x))
        x+=1
    return out
W=640
def bodyx(c):
    a=np.array(c)[...,3]>128; h=a.shape[0]
    band=a[int(h*0.60):int(h*0.70)]; xs=np.nonzero(band)[1]
    return (xs.min()+xs.max())/2
def place(c,s):
    c=c.resize((round(c.width*s),round(c.height*s)),Image.LANCZOS)
    bx=bodyx(c)
    can=Image.new('RGBA',(W,720),(0,0,0,0)); can.alpha_composite(c,(round(W/2-bx),700-c.height)); return can
def dropright(c,frac):
    a=np.array(c); al=a[...,3]>40; lab,n=ndimage.label(al)
    for i in range(1,n+1):
        ys,xs=np.nonzero(lab==i)
        if xs.mean()>c.width*frac: a[...,3][lab==i]=0
    o=Image.fromarray(a); return o.crop(o.getbbox())
cfg={'outfit1_hotot':('1760d83d',None,(0,1,2),False),
'outfit2_mumyeong':('8771b1d7',None,(0,1,2),True),
'outfit3_dopo':('451d16ff',None,(0,1,2),True),
'outfit4_cheollik':('68f82c7e','68f82c7e_fix.png',(0,1,2),True),
'outfit5_dujeonggap':('fc0fed32','fc0fed32_fix.png',(0,1,2),True),
'outfit6_sinseon':('bccb21a4',None,(0,1,3),True)}
if __name__=="__main__":
 for d,(f,fix,idx,mir) in cfg.items():
     shutil.copy(U+f+'-image.jpg',S+d+'_punch.jpg')
     im=Image.open(fix if fix else U+f+'-image.jpg').convert('RGB')
     ss=segs(im); print(d,ss)
     if d=='outfit6_sinseon': ss=[ss[0],(390,800),None,ss[2]]
     fs=[cutout(im,(max(0,ss[i][0]-10),0,min(im.width,ss[i][1]+10),im.height)) for i in idx]
     if d=='outfit6_sinseon': fs[1]=dropright(fs[1],0.8)
     st=Image.open(R+d+'/front.png'); 
     s=640/fs[0].height
     if mir: fs[1]=ImageOps.mirror(fs[1])
     for n,c in zip(['front_punch','side_punch','back_punch'],fs):
         p=place(c,s); p.save(R+d+f'/{n}.png'); print(' ',n,c.size,'->',p.getbbox())
