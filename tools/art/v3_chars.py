# 새 그림체(v3) 옷 6종: 서 있기·걷기(400x720) + 주먹(640x720). 원본 assets/source/v3/
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from punch import segs, place as place640, dropright
from PIL import Image, ImageOps
import numpy as np, json
S='/home/claude/seolhwa-rpg/assets/source/v3/'
R='/home/claude/seolhwa-rpg/assets/characters/'
def fig(im,s,e): return cutout(im,(max(0,s-10),0,min(im.width,e+10),im.height))
def place400(c,s):
    c=c.resize((round(c.width*s),round(c.height*s)),Image.LANCZOS)
    can=Image.new('RGBA',(400,720),(0,0,0,0)); can.alpha_composite(c,((400-c.width)//2,700-c.height)); return can
def faces_right(c):
    """옆모습이 오른쪽을 보는지: 머리(위 30%)에서 피부색 무게중심이 머리 전체 무게중심보다 오른쪽이면 오른쪽"""
    a=np.array(c).astype(int); al=a[...,3]>128; h=a.shape[0]; top=slice(0,int(h*0.3))
    r,g,b=a[...,0],a[...,1],a[...,2]; skin=(r>200)&(g>150)&(b>110)&(r>g)&(g>b)&al
    hx=np.nonzero(al[top])[1].mean(); sx=np.nonzero(skin[top])[1]
    return len(sx)>20 and sx.mean()>hx
cfg={ # 폴더: (서있기 파일, 고를 순서 f/s/b, 걷기 파일, 순서, 주먹 파일)
'outfit1_hotot':('outfit1_turnaround.jpg',(0,1,2),'outfit1_walk.jpg',(0,1,2),'outfit1_hotot_punch.jpg'),
'outfit2_mumyeong':('outfit2_turnaround.webp',(0,2,3),'outfit2_walk.webp',(0,1,2),'outfit2_mumyeong_punch.webp'),
'outfit3_dopo':('outfit3_turnaround.webp',(0,1,3),'outfit3_walk.webp',(0,1,3),'outfit3_dopo_punch.webp'),
'outfit4_cheollik':('outfit4_turnaround.webp',(0,2,3),'outfit4_walk.webp',(0,1,3),'outfit4_cheollik_punch.webp'),
'outfit5_dujeonggap':('outfit5_turnaround.webp',(0,1,2),'outfit5_walk.webp',(0,1,2),'outfit5_dujeonggap_punch.webp'),
'outfit6_sinseon':('outfit6_turnaround.webp',(0,1,2),'outfit6_walk.webp',(0,1,3),'outfit6_sinseon_punch.webp')}
log={}
for d,(tf,ti,wf,wi,pf) in cfg.items():
    im=Image.open(S+tf).convert('RGB'); ss=segs(im); fs=[fig(im,*ss[i]) for i in ti]
    s=640/fs[0].height; mir=faces_right(fs[1])
    if mir: fs[1]=ImageOps.mirror(fs[1])
    for n,c in zip(['front','side','back'],fs): place400(c,s).save(R+d+f'/{n}.png')
    im=Image.open(S+wf).convert('RGB'); ss=segs(im); ws=[fig(im,*ss[i]) for i in wi]
    s2=s if abs(ws[0].height-fs[0].height)/fs[0].height<0.03 else 640/ws[0].height
    wm=faces_right(ws[1])
    if wm: ws[1]=ImageOps.mirror(ws[1])
    for n,c in zip(['front_step','side_step','back_step'],ws): place400(c,s2).save(R+d+f'/{n}.png')
    im=Image.open(S+pf).convert('RGB'); ss=segs(im); ps=[fig(im,*ss[i]) for i in (0,1,2)]
    s3=640/ps[0].height; pm=faces_right(ps[1])
    if pm: ps[1]=ImageOps.mirror(ps[1])
    for n,c in zip(['front_punch','side_punch','back_punch'],ps): place640(c,s3).save(R+d+f'/{n}.png')
    log[d]=dict(stand_mirror=bool(mir),walk_mirror=bool(wm),punch_mirror=bool(pm),walk_scale=round(s2/s,3))
print(json.dumps(log,ensure_ascii=False,indent=0))
# 신선복 주먹 시트는 옆모습과 뒷모습이 붙어 한 덩어리 → 가장 빈 세로줄(560~860)에서 잘라 옆모습만
im=Image.open(S+'outfit6_sinseon_punch.webp').convert('RGB'); a=np.array(im); col=(a.min(2)<225)[:,390:1012].sum(0)
xs=np.arange(390,1012); w=(xs>560)&(xs<860); cut=int(xs[w][np.argmin(col[w])])
front=cutout(im,(66,0,368,768))
place640(ImageOps.mirror(cutout(im,(380,0,cut,768))),640/front.height).save(R+'outfit6_sinseon/side_punch.png')
