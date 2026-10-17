# 옷 2~6 무기 자세(Flow 49~68, 2026-10-18) → assets/characters/<옷>/{front,side,back}_{hold,raise,swing,strike}.png + _hand.png
# v3_weapons.py(홑옷)와 같은 방식: 640×720, 발 y=700, 몸통 가운데 x=320.
#   배율: hold = 640/정면 키, 나머지 = 640/(뒷면의 머리 꼭대기~발) — 치켜든 주먹은 키에서 뺌.
#   쥐는 점: 홑옷 쥐는 점(data/weapons.json attach.outfit1_hotot) 근처(반지름 R)에서 가장 큰 피부색 덩어리의 가운데.
#   손 덮개: 그 덩어리 +4px.
# 결과 쥐는 점은 assets/characters/<옷>/weapon_grips.json (Claude Code가 data/weapons.json attach로 옮김).
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from punch import segs, bodyx, W
from PIL import Image, ImageOps, ImageDraw
import numpy as np, json
from scipy import ndimage
G='/home/claude/seolhwa-rpg/'
S=G+'assets/source/v3/'
WP=json.load(open(G+'data/weapons.json'))
REF=WP['attach']['outfit1_hotot']
# 시트에서 고를 사람(정면·옆면·뒷면 순서). 4명 시트는 홑옷과 같은 손(뒷면은 오른쪽으로 주먹 낸 사람)을 고름
PICK={('outfit3_dopo','hold'):(0,1,3),('outfit5_dujeonggap','hold'):(0,1,3),
      ('outfit5_dujeonggap','raise'):(0,1,3),('outfit6_sinseon','hold'):(0,1,3)}
OUT=['outfit2_mumyeong','outfit3_dopo','outfit4_cheollik','outfit5_dujeonggap','outfit6_sinseon']
POSES=['hold','raise','swing','strike']
R_SEARCH=90
# Flow가 정면을 좌우 바꿔 그린 것(치켜든 손이 반대) → 정면만 좌우 반전 (2026-10-18 확인: 신선복 휘두르기 중간)
MIRROR_FRONT={('outfit6_sinseon','swing')}
# 신선복은 크림색 비단이 피부색과 비슷해 자동 찾기가 소매를 잡음 → 눈으로 잰 주먹 가운데(2026-10-18)
MANUAL={('outfit6_sinseon','back_hold'):(456,395),('outfit6_sinseon','front_swing'):(191,152),
        ('outfit6_sinseon','side_strike'):(144,472),('outfit6_sinseon','front_strike'):(305,502)}
def cover_by_color(img,cx,cy,rad=27):
    # 주먹 가운데 반지름 rad 안에서 피부빛(r-g 큼 — 크림색 비단은 r-g 작음)이면서 가운데와 이어진 부분
    A=np.array(img).astype(int); r,g,b,al=A[...,0],A[...,1],A[...,2],A[...,3]
    yy,xx=np.mgrid[:720,:640]; disc=((xx-cx)**2+(yy-cy)**2)<rad**2
    m=disc&(al>200)&(r-g>20)&(r>110)
    m=ndimage.binary_closing(m,iterations=2); lab,_=ndimage.label(m)
    if lab[cy,cx]: m=lab==lab[cy,cx]
    m=ndimage.binary_fill_holes(ndimage.binary_dilation(m,iterations=3))&(al>0)&(((xx-cx)**2+(yy-cy)**2)<(rad+5)**2)
    h=np.array(img).copy(); h[...,3]=np.where(m,h[...,3],0); return Image.fromarray(h.astype(np.uint8))
def fig(im,s,e): return cutout(im,(max(0,s-10),0,min(im.width,e+10),im.height))
def centertop(c):
    a=np.array(c)[...,3]>128; bx=bodyx(c); ys=np.nonzero(a[:,int(bx-25):int(bx+25)].any(1))[0]; return ys.min()
def faces_right(c):
    # 머리(위 30%, 몸통 가운데 ±60px만 — 치켜든 주먹 빼고)에서 피부색이 머리 가운데보다 오른쪽이면 오른쪽을 봄
    a=np.array(c).astype(int); al=a[...,3]>128; h=a.shape[0]; bx=int(bodyx(c))
    sl=(slice(0,int(h*0.3)),slice(max(0,bx-60),bx+60))
    r,g,b=a[...,0],a[...,1],a[...,2]; skin=(r>200)&(g>150)&(b>110)&(r>g)&(g>b)&al
    hx=np.nonzero(al[sl])[1].mean(); sx=np.nonzero(skin[sl])[1]
    return len(sx)>20 and sx.mean()>hx
def put(c,s):
    c2=c.resize((round(c.width*s),round(c.height*s)),Image.LANCZOS); bx=bodyx(c2)
    can=Image.new('RGBA',(W,720)); can.alpha_composite(c2,(round(W/2-bx),700-c2.height)); return can
log={}
for o in OUT:
    D=G+f'assets/characters/{o}/'; grips={}; log[o]={}
    for k in POSES:
        im=Image.open(S+f'{o}_{k}.webp').convert('RGB'); ss=segs(im)
        idx=PICK.get((o,k),(0,1,2)); fs=[fig(im,*ss[i]) for i in idx]
        if (o,k) in MIRROR_FRONT: fs[0]=ImageOps.mirror(fs[0])
        mir=faces_right(fs[1])
        if mir: fs[1]=ImageOps.mirror(fs[1])
        s=640/fs[0].height if k=='hold' else 640/(fs[2].height-centertop(fs[2]))
        log[o][k]=dict(mirror=bool(mir),scale=round(s,3))
        for d,c in zip(['front','side','back'],fs):
            img=put(c,s); n=f'{d}_{k}'; img.save(D+n+'.png')
            x,y=REF[k][d]['grip']
            if (o,n) in MANUAL:
                cx,cy=MANUAL[(o,n)]; cover_by_color(img,cx,cy).save(D+n+'_hand.png'); grips[n]=[cx,cy]; continue
            A=np.array(img).astype(int); r,g,b,al=A[...,0],A[...,1],A[...,2],A[...,3]
            # 피부: 금빛 테두리(b 낮음)·크림색 비단(r-g 작음)을 빼려고 조건을 좁힘
            skin=(al>200)&(r>185)&(r-b>30)&(r-b<110)&(g>120)&(b>110)&(r-g>32)
            if d=='back': skin|=(al>200)&(r>140)&(r<235)&(r-g>35)&(b>80)&(np.abs(g-b)<25)   # 뒷면 주먹은 그늘져 어두움
            yy,xx=np.mgrid[:720,:640]; near=((xx-x)**2+(yy-y)**2)<R_SEARCH**2
            lab,nl=ndimage.label(skin&near); best=None
            bx=bodyx(img); top=np.nonzero(al.max(1)>128)[0][0]
            for i in range(1,nl+1):
                ys,xs=np.nonzero(lab==i)
                if len(xs)<120: continue
                cx,cy=xs.mean(),ys.mean()
                if cy<top+200 and abs(cx-bx)<75 and len(xs)>1500: continue   # 얼굴 빼기
                dd=(cx-x)**2+(cy-y)**2
                if best is None or dd<best[0]: best=(dd,i)
            if (d,k)==('back','strike'): best=None   # 뒷면 내려치기: 치는 주먹은 몸 앞이라 안 보임(보이는 손은 반대 손) → 홑옷 값
            if best is None:
                # 주먹이 몸에 가려 안 보임(뒷면 내려치기 등) → 홑옷 쥐는 점 그대로, 손 덮개는 빈 그림
                print('NO FIST -> ref',o,n); grips[n]=[x,y]
                Image.new('RGBA',(640,720)).save(D+n+'_hand.png'); continue
            comp=ndimage.binary_closing(lab==best[1],iterations=3)
            ys,xs=np.nonzero(comp); cx,cy=int(round(xs.mean())),int(round(ys.mean()))
            near2=((xx-cx)**2+(yy-cy)**2)<38**2
            # 주먹의 밝은 부분(하이라이트)까지 덮도록: 가운데 26px 안의 연한 피부색도 포함
            loose=(al>200)&(r>150)&(r-b>15)&(r-g>25)&(((xx-cx)**2+(yy-cy)**2)<26**2)
            cover=ndimage.binary_fill_holes(ndimage.binary_dilation(comp|loose,iterations=4))&(al>0)&near2
            h=np.array(img).copy(); h[...,3]=np.where(cover,h[...,3],0); Image.fromarray(h.astype(np.uint8)).save(D+n+'_hand.png')
            grips[n]=[cx,cy]
    json.dump(grips,open(D+'weapon_grips.json','w'),indent=0)
print(json.dumps(log,indent=0))
# 들고 걷기(hold_step) = 들고 서 있기 윗몸 + 기존 걷기(*_step.png) 다리. 경계 = data/outfits.json legSplitY(옷 아랫단 바로 아래)
# 윗몸이 그대로라 쥐는 점·손 덮개는 hold와 같음.
OUTF={x['id']:x for x in json.load(open(G+'data/outfits.json'))['outfits']}
def to640(p):
    im=Image.open(p).convert('RGBA')
    if im.width==640: return im
    c=Image.new('RGBA',(640,720)); c.alpha_composite(im,(120,0)); return c
for o in OUT:
    D=G+f'assets/characters/{o}/'; Y=OUTF[o]['legSplitY']; grips=json.load(open(D+'weapon_grips.json'))
    for d in ['front','side','back']:
        h=to640(D+f'{d}_hold.png'); s=to640(D+f'{d}_step.png')
        out=Image.new('RGBA',(640,720)); out.alpha_composite(s.crop((0,Y,640,720)),(0,Y)); out.alpha_composite(h.crop((0,0,640,Y)),(0,0))
        out.save(D+f'{d}_hold_step.png'); Image.open(D+f'{d}_hold_hand.png').save(D+f'{d}_hold_step_hand.png')
        grips[f'{d}_hold_step']=grips[f'{d}_hold']
    json.dump(grips,open(D+'weapon_grips.json','w'),indent=0)
