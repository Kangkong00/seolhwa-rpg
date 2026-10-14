# 새 그림체(v3) 몬스터: 서 있기 3장 + 걷기 3장 → assets/monsters/<id>/ (640×400, 발 y=380, 가로 가운데, 정면 서 있기 키 240)
# 꼬리 때문에 붙어 있는 그림은 가장 얇은 세로줄에서 자름. 옆모습은 왼쪽을 보게(몸통이 두꺼운 쪽 = 머리 쪽).
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from punch import segs
from PIL import Image, ImageOps
import numpy as np, os, json
V='/home/claude/seolhwa-rpg/assets/source/v3/'
M='/home/claude/seolhwa-rpg/assets/monsters/'
def boxes(im):
    a=np.array(im); col=(a.min(2)<225).sum(0); ss=segs(im)
    while len(ss)<3:
        i=max(range(len(ss)),key=lambda k:ss[k][1]-ss[k][0]); s,e=ss[i]; w=e-s
        xs=np.arange(s+int(w*0.25),s+int(w*0.75)); cut=int(xs[np.argmin(col[xs])])
        ss=ss[:i]+[(s,cut),(cut,e)]+ss[i+1:]
    return ss[:3]
def fig(im,s,e,pad):
    return cutout(im,(max(0,s-pad),0,min(im.width,e+pad),im.height))
def faces_right(c):
    a=np.array(c)[...,3]>128; col=a.sum(0); thick=np.nonzero(col>0.45*col.max())[0]
    return (thick.min()+thick.max())/2 > a.shape[1]/2
def place(c,s):
    c=c.resize((max(1,round(c.width*s)),max(1,round(c.height*s))),Image.LANCZOS)
    can=Image.new('RGBA',(640,400)); can.alpha_composite(c,(320-c.width//2,380-c.height)); return can
cfg={'rat':('monster_rat_turnaround.webp','monster_rat_walk.webp'),
     'bigrat':('monster_bigrat_turnaround.jpg','monster_bigrat_walk.webp'),
     'rat_king':('monster_ratking_turnaround.webp','monster_ratking_walk.webp'),
     'weasel':('monster_weasel_turnaround.webp','monster_weasel_walk.webp')}
FORCE={('bigrat',''):False}   # 큰 들쥐 앉은 옆모습은 자동 판단이 틀림 — 원본이 이미 왼쪽을 봄
log={}
for mid,(tf,wf) in cfg.items():
    os.makedirs(M+mid,exist_ok=True); info={}
    scale=None
    for f,suf in [(tf,''),(wf,'_step')]:
        im=Image.open(V+f).convert('RGB'); bx=boxes(im); pad=0 if len(segs(im))<3 else 10
        fs=[fig(im,s,e,pad) for s,e in bx]
        fr=FORCE.get((mid,suf),faces_right(fs[1]))
        if fr: fs[1]=ImageOps.mirror(fs[1]); info['mirror'+suf]=True
        if scale is None: scale=240/fs[0].height; tw=im.width        # 정면 서 있기 키 240
        s=scale*tw/im.width                                             # 걷기 시트는 같은 그림 배율(시트 해상도만 보정)
        for n,c in zip(['front','side','back'],fs):
            p=place(c,s);
            if p.getbbox() is None or p.getbbox()[0]==0 or p.getbbox()[2]==640: print('WARN edge',mid,n+suf,p.getbbox())
            p.save(M+mid+f'/{n}{suf}.png'); info[n+suf]=p.getbbox()
    log[mid]=info
print(json.dumps(log,indent=0,default=str))
