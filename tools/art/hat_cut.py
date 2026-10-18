# 모자 오리기(챙 있는 모자 — 패랭이 등). 홑옷 3방향 시트와 위치가 같은 '모자 쓴 홑옷' 시트에서 모자만 오림.
# 두건(hood_cut_v3.py)과 같은 자리 맞춤(홑옷 서 있기와 똑같은 변환 → 400×720, 발 700)을 쓰고,
# 모자는 색(모자 색 범위)으로 찾은 뒤 구멍을 메워 띠(검은 천)까지 포함. 피부·머리카락은 안 가져옴.
# 쓰는 법: python3 hat_cut.py <시트 파일> <출력 폴더 이름>   예) head_paraengi_sheet.webp paraengi
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from punch import segs
from PIL import Image
import numpy as np, os
from scipy import ndimage
from scipy.ndimage import gaussian_filter
V='/home/claude/seolhwa-rpg/assets/source/v3/'
OUT='/home/claude/seolhwa-rpg/assets/equipment/head/'+sys.argv[2]+'/'
os.makedirs(OUT,exist_ok=True)
hat=Image.open(V+sys.argv[1]).convert('RGB'); body=Image.open(V+'outfit1_turnaround.jpg').convert('RGB')
bss=segs(body)[:3]
a=np.array(hat).astype(float); r,g,b=a[...,0],a[...,1],a[...,2]
straw=(r>120)&(g>90)&(b<0.80*r)&(g>0.62*r)&(r-b>35)&(a.min(2)<235)     # 볏짚·대나무 색
skin=(r>190)&(b>=0.60*r)&(g<0.90*r)&(r-g>25)
figs=[cutout(body,(max(0,s-10),0,min(body.width,e+10),body.height)) for s,e in bss]
sc=640/figs[0].height
for name,(x0,x1),full in zip(['front','side','back'],bss,figs):
    reg=np.zeros(straw.shape,bool); reg[:int(sys.argv[3]) if len(sys.argv)>3 else 270,max(0,x0-90):x1+90]=True   # 머리 높이까지만(아래 옷깃 제외)
    m=straw&reg&~skin
    m=ndimage.binary_opening(m,iterations=2)                       # 얼굴 얼룩 같은 작은 점 제거
    lab,n=ndimage.label(m); sz=ndimage.sum(m,lab,range(1,n+1))
    keep=[i+1 for i,v in enumerate(sz) if v>0.03*sz.max()]
    tops={i:np.where(lab==i)[0].min() for i in keep}; crown=min(keep,key=lambda i:tops[i])
    cb=np.where(lab==crown)[0].max()                                   # 모자 몸통 아래끝
    keep=[i for i in keep if tops[i]<cb+40]                            # 몸통 바로 아래에서 시작하는 챙까지만(그 아래 코·얼굴 얼룩 제외)
    m=np.isin(lab,keep)
    # 검은 띠·챙 사이 틈: 세로로 41px 닫기(모자색·어두운 색 화소 안에서만)
    allow=(straw|(a.max(2)<120))&reg&~skin
    vc=ndimage.binary_closing(m,structure=np.ones((41,1)))&allow
    m=m|vc
    m=ndimage.binary_closing(m,iterations=2)
    m=ndimage.binary_dilation(m,iterations=2)&(a.min(2)<240)&~skin&reg
    filled=ndimage.binary_fill_holes(m); hl,hn=ndimage.label(filled&~m)
    for i in range(1,hn+1):
        if (hl==i).sum()<400: m|=(hl==i)
    m=m&(a.min(2)<245)
    bx=(max(0,x0-10),0,min(body.width,x1+10),body.height)
    crop=np.array(body.crop(bx)).astype(int)
    ys=np.where((crop.min(2)<=225).any(1))[0]; xs=np.where((crop.min(2)<=225).any(0))[0]
    oy,ox=ys[0],xs[0]
    dy=max(0,(full.height-(ys[-1]-ys[0]+1))//2); dx=max(0,(full.width-(xs[-1]-xs[0]+1))//2); oy-=dy; ox-=dx
    # 모자 챙은 몸 상자보다 넓을 수 있음 → 상자 양옆으로 90px 넓혀서 같은 기준점으로 자름
    PAD=90
    H=np.zeros((full.height,full.width+2*PAD,4),np.uint8)
    xa=bx[0]+ox-PAD; ya=oy
    src=np.array(hat.convert('RGBA')); mk=m
    for yy in range(full.height):
        Y=ya+yy
        if Y<0 or Y>=src.shape[0]: continue
        X0=max(0,xa); X1=min(src.shape[1],xa+full.width+2*PAD)
        H[yy,X0-xa:X1-xa,:3]=src[Y,X0:X1,:3]; H[yy,X0-xa:X1-xa,3]=(mk[Y,X0:X1]*255)
    H[...,3]=(gaussian_filter(H[...,3].astype(float),0.7)).clip(0,255).astype(np.uint8)
    hi=Image.fromarray(H).resize((round(H.shape[1]*sc),round(H.shape[0]*sc)),Image.LANCZOS)
    can=Image.new('RGBA',(400,720)); can.alpha_composite(hi,((400-hi.width)//2,700-hi.height)); can.save(OUT+name+'.png')
    print(name,'ok',hi.size)
