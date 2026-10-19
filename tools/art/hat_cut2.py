# 모자 오리기 2(색과 무관) — '모자 쓴 홑옷' 시트와 홑옷 3방향 시트(outfit1_turnaround.jpg)는 인물 위치가 같음(Flow 참조 방식)
# → 두 그림의 색 차이 중 머리 위쪽에서 크게 이어진 덩어리 = 모자. 피부(얼굴)는 뺌, 가는 끈(턱끈)은 열기(opening)로 지움.
# 홑옷 서 있기와 같은 변환(→ 400×720, 발 700)으로 놓음. 쓰는 법: python3 hat_cut2.py <시트> <폴더> [머리 아래끝 y(기본 300)]
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from punch import segs
from PIL import Image
import numpy as np, os
from scipy import ndimage
from scipy.ndimage import gaussian_filter
V='/home/claude/seolhwa-rpg/assets/source/v3/'; OUT='/home/claude/seolhwa-rpg/assets/equipment/head/'+sys.argv[2]+'/'
YMAX=int(sys.argv[3]) if len(sys.argv)>3 else 300
os.makedirs(OUT,exist_ok=True)
hat=Image.open(V+sys.argv[1]).convert('RGB').resize((1376,768)); body=Image.open(V+'outfit1_turnaround.jpg').convert('RGB')
bss=segs(body)[:3]
a=np.array(hat).astype(float); o=np.array(body).astype(float)
dif=np.sqrt(((gaussian_filter(a,(1.5,1.5,0))-gaussian_filter(o,(1.5,1.5,0)))**2).sum(2))>55
r,g,b=a[...,0],a[...,1],a[...,2]
skin=(r>180)&(b>=0.55*r)&(g<0.92*r)&(r-g>18)&(r-b>30)
fg=a.min(2)<238
figs=[cutout(body,(max(0,s-10),0,min(body.width,e+10),body.height)) for s,e in bss]
sc=640/figs[0].height
for name,(x0,x1),full in zip(['front','side','back'],bss,figs):
    reg=np.zeros(dif.shape,bool); reg[:YMAX,max(0,x0-110):x1+110]=True
    m=dif&fg&reg&~skin
    m=ndimage.binary_opening(m,iterations=3)                       # 가는 끈·잡티 제거
    lab,n=ndimage.label(m); sz=ndimage.sum(m,lab,range(1,n+1))
    m=np.isin(lab,[i+1 for i,v in enumerate(sz) if v>0.06*sz.max()])
    m=ndimage.binary_closing(m,iterations=3); m=ndimage.binary_fill_holes(m)
    # 구멍 메우기: 원래 머리카락과 색이 비슷해 차이가 안 난 곳 → 챙(가장 넓은 줄)까지는 줄마다 모자 왼끝~오른끝을 채움(피부·배경 제외)
    rows=np.where(m.any(1))[0]
    if len(rows):
        widths=[(np.where(m[y])[0].max()-np.where(m[y])[0].min()) for y in rows]
        ybrim=rows[int(np.argmax(widths))]
        for y in rows:
            if y>ybrim+8: break
            xs_=np.where(m[y])[0]; seg=np.zeros(m.shape[1],bool); seg[xs_.min():xs_.max()+1]=True
            m[y]|=seg&fg[y]&~skin[y]
    m=ndimage.binary_closing(m,iterations=2)
    m|=ndimage.binary_closing(m,structure=np.ones((21,1)))&fg&~skin   # 가로로 난 가는 틈(끈 자국) 메움
    m=ndimage.binary_dilation(m,iterations=2)&fg&reg&~skin
    bx=(max(0,x0-10),0,min(body.width,x1+10),body.height)
    crop=np.array(body.crop(bx)).astype(int)
    ys,xs=np.where((crop.min(2)<=225).any(1))[0],np.where((crop.min(2)<=225).any(0))[0]
    oy,ox=ys[0],xs[0]
    dy=max(0,(full.height-(ys[-1]-ys[0]+1))//2); dx=max(0,(full.width-(xs[-1]-xs[0]+1))//2); oy-=dy; ox-=dx
    PAD=110; H=np.zeros((full.height,full.width+2*PAD,4),np.uint8); xa=bx[0]+ox-PAD
    src=np.array(hat.convert('RGBA'))
    for yy in range(full.height):
        Y=oy+yy
        if Y<0 or Y>=src.shape[0]: continue
        X0=max(0,xa); X1=min(src.shape[1],xa+full.width+2*PAD)
        H[yy,X0-xa:X1-xa,:3]=src[Y,X0:X1,:3]; H[yy,X0-xa:X1-xa,3]=m[Y,X0:X1]*255
    H[...,3]=gaussian_filter(H[...,3].astype(float),0.7).clip(0,255).astype(np.uint8)
    hi=Image.fromarray(H).resize((round(H.shape[1]*sc),round(H.shape[0]*sc)),Image.LANCZOS)
    can=Image.new('RGBA',(400,720)); can.alpha_composite(hi,((400-hi.width)//2,700-hi.height)); can.save(OUT+name+'.png')
print('ok',sys.argv[2])
