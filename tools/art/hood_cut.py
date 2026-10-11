# 두건 오리기: 두건 쓴 3방향 시트(인자) - 원본 홑옷 시트와 픽셀 비교 + 천 색으로 두건만 오림 -> hood2_{front,side,back}.png (400x720 서 있기 캔버스). 끝부분은 옷 6종 시안 만들기
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from PIL import Image
import numpy as np
from scipy import ndimage
S='/tmp/claude-0/-home-claude-seolhwa-rpg/1798b720-9bbd-5e1d-af87-0516171baaa5/scratchpad/'
R='/home/claude/seolhwa-rpg/assets/characters/'
NEW=sys.argv[1]
OLD='/home/claude/seolhwa-rpg/assets/source/outfit1_turnaround.webp'
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
old=Image.open(OLD); oss=segs(old)
ofig=cutout(old,(max(0,oss[0][0]-10),0,oss[0][1]+10,old.height)); s=640/ofig.height
new=Image.open(NEW).convert('RGB'); nss=segs(new)
print('old',oss,'new',nss)
a=np.array(new).astype(int); r,g,b=a[...,0],a[...,1],a[...,2]
cloth=(b<0.62*r)&(r>100)&(g>0.72*r)
skin=(r>190)&(b>=0.62*r)&(g<0.93*r)
fg=a.min(2)<230
oa=np.array(old.convert('RGB')).astype(float)
from scipy.ndimage import gaussian_filter
dif=np.sqrt(((gaussian_filter(a.astype(float),(1.2,1.2,0))-gaussian_filter(oa,(1.2,1.2,0)))**2).sum(2))>45
# canvas transform identical to pipeline: figure bbox -> scale s -> centered, feet at 700
hoods={}
for name,(x0,x1) in zip(['front','side','back'],nss):
    reg=np.zeros(cloth.shape,bool); reg[:330,x0:x1]=True
    m=cloth&reg
    lab,n=ndimage.label(m); sz=ndimage.sum(m,lab,range(1,n+1)); m=lab==(1+np.argmax(sz))  # main hood blob only
    # add changed pixels vs the original sheet (tails over the shirt, patches), connected to the hood
    reg2=np.zeros(cloth.shape,bool); reg2[:400,x0-5:x1+5]=True
    d=ndimage.binary_opening(dif&reg2&fg&~skin,iterations=1)|m
    dl,dn=ndimage.label(d); keep=np.unique(dl[m]); keep=keep[keep>0]
    m=np.isin(dl,keep); reg=reg2
    m=ndimage.binary_closing(m,iterations=3)
    m=ndimage.binary_dilation(m,iterations=3)&fg&~skin&reg   # pick up outlines, never skin
    m=ndimage.binary_opening(m,iterations=1)
    filled=ndimage.binary_fill_holes(m); holes=filled&~m
    hl,hn=ndimage.label(holes)
    if hn:
        hs=ndimage.sum(holes,hl,range(1,hn+1))
        for i,v in enumerate(hs,1):
            if v<2500: m|=(hl==i)
    # figure bbox (same as cutout bbox)
    bx=(max(0,x0-10),0,min(new.width,x1+10),new.height)
    fig=cutout(new,bx); crop=np.array(new.crop(bx)).astype(int)
    ys=np.where((crop.min(2)<=225).any(1))[0]; xs=np.where((crop.min(2)<=225).any(0))[0]
    oy,ox=ys[0],xs[0]
    mk=m[:,bx[0]:bx[2]][oy:oy+fig.height,ox:ox+fig.width]
    f=np.array(fig); f[...,3]=(f[...,3]*ndimage.gaussian_filter(mk.astype(float),0.7)).clip(0,255).astype(np.uint8)
    fi=Image.fromarray(f).resize((round(fig.width*s),round(fig.height*s)),Image.LANCZOS)
    can=Image.new('RGBA',(400,720),(0,0,0,0)); can.alpha_composite(fi,((400-fi.width)//2,700-fi.height))
    hoods[name]=can; can.save(S+f'hood2_{name}.png')
def wear(body,hood):
    bA=np.array(body); hA=np.array(hood)[...,3]>40
    # erase body pixels above the hood's top edge in each column (hides the top-knot)
    cols=np.where(hA.any(0))[0]; tops={x:np.argmax(hA[:,x]) for x in cols}
    lo,hi=cols.min(),cols.max(); gtop=min(tops.values())
    for x in range(bA.shape[1]):
        if x in tops: top=tops[x]
        elif lo-25<=x<lo: top=tops[lo]+ (lo-x)*2
        elif hi<x<=hi+25: top=tops[hi]+ (x-hi)*2
        else: top=gtop
        bA[:top,x,3]=0
    # also erase hair pixels just outside the hood's top silhouette (a few px band)
    out=Image.fromarray(bA); out.alpha_composite(hood); return out
tiles=[]
for d in ['outfit1_hotot','outfit2_mumyeong','outfit3_dopo','outfit4_cheollik','outfit5_dujeonggap','outfit6_sinseon']:
    for n in ['front','side','back']:
        bd=Image.open(R+d+f'/{n}.png').convert('RGBA'); w=wear(bd,hoods[n])
        c=Image.new('RGBA',w.size,(255,255,255,255)); c.alpha_composite(w); tiles.append(c.convert('RGB'))
# full sheet and head close-ups
W=Image.new('RGB',(400*9,720*2),'white')
for i,t in enumerate(tiles): W.paste(t,((i%9)*400,(i//9)*720))
W.resize((W.width//3,W.height//3),Image.LANCZOS).save(S+'hood2_all.png')
H=Image.new('RGB',(240*9,280*2),'white')
for i,t in enumerate(tiles): H.paste(t.crop((80,20,320,300)),((i%9)*240,(i//9)*280))
H.save(S+'hood2_heads.png')
tiles=[]
for d in ['outfit1_hotot','outfit3_dopo','outfit6_sinseon']:
    for n in ['front_step','side_step','back_step','front_punch','side_punch','back_punch']:
        bd=Image.open(R+d+f'/{n}.png').convert('RGBA')
        base=n.split('_')[0]; hd=hoods[base]
        if bd.size!=hd.size:
            c2=Image.new('RGBA',bd.size,(0,0,0,0)); c2.alpha_composite(hd,((bd.width-hd.width)//2,0)); hd=c2
        w=wear(bd,hd); c=Image.new('RGBA',w.size,(255,255,255,255)); c.alpha_composite(w); tiles.append(c.convert('RGB').crop(((w.width-400)//2,0,(w.width+400)//2,400)))
P=Image.new('RGB',(400*6,400*3),'white')
for i,t in enumerate(tiles): P.paste(t,((i%6)*400,(i//6)*400))
P.resize((P.width//2,P.height//2)).save(S+'hood2_poses.png')
