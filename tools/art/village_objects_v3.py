# 맵 물건 조각(앞뒤 가림) — 새 그림체(v3)판. 사용: python3 village_objects_v3.py [맵 id] (기본 village, 예: dungeon_rat_1)
# 필요한 것: data/maps/<id>.json 격자, 원본 assets/source/v3/<id>.jpg, 빈 바닥판 assets/source/v3/<id>_ground.jpg
# 순서: 1) 새 마을 그림(1376으로 줄임) vs 빈 바닥판(ECC로 맞춤) 색 차이  2) 격자로 픽셀별 발 기준선  3) 8px 올림·최빈값 다듬기  4) 아틀라스
# 지붕(초가 = 흙색이라 차이가 약함)은 옛 손 다각형(village_old_occluders.json)을 더함 — 새 그림도 위치가 같음(ECC 어긋남 < 0.2px)
import numpy as np, cv2, json, os, shutil, sys
from PIL import Image
G='/home/claude/seolhwa-rpg/'

MID=sys.argv[1] if len(sys.argv)>1 else 'village'
S=f'/tmp/claude-0/-home-claude-seolhwa-rpg/1798b720-9bbd-5e1d-af87-0516171baaa5/scratchpad/vo3_{MID}/'; os.makedirs(S,exist_ok=True)
SRC=G+f'assets/source/v3/{MID}.jpg'; GROUND=G+f'assets/source/v3/{MID}_ground.jpg'
# 게임 맵 그림: 새 마을을 2752×1536으로
import sys; sys.path.insert(0,G+'tools/art'); from v3_maps import dewm
Image.fromarray(dewm(np.array(Image.open(SRC).convert('RGB').resize((2752,1536),Image.LANCZOS)))[0]).save(G+f'assets/maps/{MID}.jpg',quality=90)   # 반짝이 지움
Image.open(G+f'assets/maps/{MID}.jpg').resize((1376,768),Image.LANCZOS).save(S+'map_1376.png')
json.dump(json.load(open(G+'tools/art/village_old_occluders.json')) if MID=='village' else [],open(S+'old_occluders.json','w'))   # 지붕 손 다각형은 마을만
from scipy import ndimage
import json, os
v=np.array(Image.open(S+'map_1376.png').convert('RGB'))
g=np.array(Image.open(GROUND).convert('RGB').resize((1376,768),Image.LANCZOS))
a=cv2.cvtColor(v,cv2.COLOR_RGB2GRAY).astype(np.float32); b=cv2.cvtColor(g,cv2.COLOR_RGB2GRAY).astype(np.float32)
W=np.eye(2,3,dtype=np.float32)
cc,W=cv2.findTransformECC(a,b,W,cv2.MOTION_AFFINE,(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,200,1e-6),None,5)
g2=cv2.warpAffine(g,W,(1376,768),flags=cv2.INTER_LINEAR+cv2.WARP_INVERSE_MAP,borderMode=cv2.BORDER_REPLICATE)
la=cv2.cvtColor(cv2.GaussianBlur(v,(0,0),1.5),cv2.COLOR_RGB2LAB).astype(float)
lb=cv2.cvtColor(cv2.GaussianBlur(g2,(0,0),1.5),cv2.COLOR_RGB2LAB).astype(float)
Image.fromarray(g2).save(S+'ground_aligned.png')
np.save(S+'diff.npy',np.sqrt(((la-lb)**2).sum(2)))

# ---- 2) 기준선 ----
T=34
d=np.load(S+'diff.npy')
vm=json.load(open(G+f'data/maps/{MID}.json')); grid=vm['blocked']; cs=vm['cellSize']
H,W=d.shape
blk=np.zeros((H,W),bool)
for r,row in enumerate(grid):
    for c,ch in enumerate(row):
        if ch=='#': blk[r*cs:(r+1)*cs, c*cs:(c+1)*cs]=True
m=d>T
# grass<->dirt swaps between the original and the ground plate are not objects: both look like plain ground and have no ink lines
V=np.array(Image.open(S+'map_1376.png').convert('RGB')).astype(int)
Gp=np.array(Image.open(S+'ground_aligned.png').convert('RGB')).astype(int)
def groundish(a):
    r,g,b=a[...,0],a[...,1],a[...,2]
    grass=(g>r+4)&(g>b+18)
    dirt=(r>g)&(g>b)&(r-b>35)&(r-b<120)&(r>150)
    return grass|dirt
gray=cv2.cvtColor(V.astype(np.uint8),cv2.COLOR_RGB2GRAY)
ink=cv2.dilate((gray<95).astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
tex=cv2.blur(np.abs(cv2.Laplacian(gray,cv2.CV_32F)),(7,7))
swap=groundish(V)&groundish(Gp)&~ink&(tex<10)
m&=~swap
m=ndimage.binary_opening(m,iterations=2)
m=ndimage.binary_closing(m,iterations=2)
holes=ndimage.binary_fill_holes(m)&~m
hl,hn=ndimage.label(holes); hs=ndimage.sum(holes,hl,range(1,hn+1))
m|=np.isin(hl,1+np.where(hs<2500)[0])
# roofs (thatch ~ dirt colour): old hand polygons
roof=np.zeros((H,W),np.uint8)
oldocc=json.load(open(S+'old_occluders.json'))
for o in oldocc:
    if o.get('shape')=='poly': cv2.fillPoly(roof,[np.array(o['points'],np.int32)],1)
m|=roof.astype(bool)
# big ground-looking patches stuck to objects (grass, dirt, cast shadow): remove if they touch the outside
L=m&(d<22)&~roof.astype(bool)
ll,ln=ndimage.label(L)
if ln:
    lsz=ndimage.sum(L,ll,range(1,ln+1))
    outside=ndimage.binary_dilation(~m,iterations=1)
    touch=ndimage.sum(outside&L,ll,range(1,ln+1))
    rm=1+np.where((lsz>=300)&(touch>0))[0]
    m&=~np.isin(ll,rm)
    m=ndimage.binary_opening(m,iterations=1)
# keep only components standing on blocked ground (real objects)
lab,n=ndimage.label(m)
onblk=ndimage.sum(blk&m,lab,range(1,n+1)); sz=ndimage.sum(m,lab,range(1,n+1))
keep=1+np.where((onblk>=60)&(sz>=150))[0]
m=np.isin(lab,keep)
# per column: bottom of the first blocked run at/below each pixel
nbm=np.full((H,W),-1,np.int32)
for x in range(W):
    cur=-1; col=blk[:,x]
    for y in range(H-1,-1,-1):
        if col[y] and (y==H-1 or not col[y+1]): cur=y
        if not col[y] and y<H-1 and col[y+1]: pass
        nbm[y,x]=cur
# a pixel belongs to that run only if the run starts within its own mask run (+12)
runbot=np.full((H,W),-1,np.int32)
base=np.full((H,W),-1,np.int32); flat=np.zeros((H,W),bool)
for x in range(W):
    col=m[:,x]; y=0
    while y<H:
        if col[y]:
            s=y
            while y<H and col[y]: y+=1
            e=y-1
            b=nbm[s:e+1,x]; runbot[s:e+1,x]=e
            ok=(b>=0)&(b<=e+12)
            # blocked ground continues below the object's own bottom: nobody can stand between -> its own bottom is the base
            inside=(~ok)&(b>e+12)&blk[min(e,H-1),x]
            base[s:e+1,x]=np.where(ok,np.minimum(b,e+4),np.where(inside,e,-1)); flat[s:e+1,x]=~(ok|inside)
        else: y+=1
# smooth steps: take max of neighbours (±16 px) whose base is within 16 of ours
sm=base.copy()
for dx in []:
    sh=np.full_like(base,-1)
    if dx>0: sh[:,dx:]=base[:,:-dx]
    elif dx<0: sh[:,:dx]=base[:,-dx:]
    else: continue
    okk=(base>=0)&(sh>=0)&(np.abs(sh-base)<=16)
    sm=np.where(okk&(sh>sm),sh,sm)
base=sm
# canopy edges / doorway gaps: fill from same-row neighbour in the same component within 120 px
lab,n=ndimage.label(base>=0|flat) if False else ndimage.label((base>=0)|flat)
R=120; b2=base.copy()
for y in range(H):
    fl=np.where(flat[y])[0]
    if len(fl)==0: continue
    good=np.where(base[y]>=0)[0]
    if len(good)==0: continue
    for x in fl:
        i=np.searchsorted(good,x); best=None
        for j in (i-1,i):
            if 0<=j<len(good):
                gx=good[j]
                if abs(gx-x)<=R and lab[y,gx]==lab[y,x] and (best is None or abs(gx-x)<abs(best-x)): best=gx
        if best is not None: b2[y,x]=min(base[y,best], runbot[y,x]+4)
base=b2
# below own base never needed
yy=np.arange(H)[:,None]
base[(base>=0)&(yy>base+2)]=-1
np.save(S+'base3.npy',base)
vis=np.array(Image.open(S+'map_1376.png').convert('RGB')).astype(float)
can=np.zeros_like(vis); can[:]=(255,0,255)
o=base>=0; can[o]=vis[o]
Image.fromarray(can.astype(np.uint8)).save(S+'pieces3.jpg')
print(o.mean())
# ---- 3) 다듬기 ----
b=np.load(S+'base3.npy'); Q=8
q=np.where(b>=0,(b+Q-1)//Q*Q,-1)
o=q>=0
for it in range(2):
    best=np.zeros(q.shape,np.float32); bv=q.copy()
    for v in np.unique(q[o]):
        c=ndimage.uniform_filter((q==v).astype(np.float32),15)
        upd=(c>best)&o
        best[upd]=c[upd]; bv[upd]=v
    ok=o&(bv<=b+8)   # never push a pixel's line more than 8 px further south
    q=np.where(ok,bv,q)
np.save(S+'base4.npy',q.astype(np.int32))
tot=0
for v in np.unique(q[o]):
    mm=q==v; l,n=ndimage.label(ndimage.binary_dilation(mm,iterations=6)); l=l*mm; tot+=len(np.unique(l[l>0]))
print('pieces',tot)
# ---- 4) 아틀라스 ----
# 마을 물건 조각 -> 아틀라스 1장(village_objects.webp) + Phaser 아틀라스 JSON + 조각 목록(baseY)
base=np.load(S+'base4.npy')
vm=json.load(open(G+f'data/maps/{MID}.json')); grid=vm['blocked']; cs=vm['cellSize']
# keep only pixels a character could stand behind (walkable within one body height below, ±16 across), padded so pieces have no square holes
wk=np.zeros((768,1376),bool)
for r,row in enumerate(grid):
    for c,ch in enumerate(row):
        if ch=='.': wk[r*cs:(r+1)*cs,c*cs:(c+1)*cs]=True
wk=ndimage.maximum_filter(wk,size=(9,33))
cum=np.vstack([np.zeros((1,1376),np.int32),np.cumsum(wk,0)])
H=768; yy=np.arange(H)[:,None]
lo=np.broadcast_to(np.clip(yy+1,0,H),base.shape); hi=np.clip(np.minimum(yy+64,base),0,H)
cnt=np.take_along_axis(cum,hi,0)-np.take_along_axis(cum,lo,0)
useful=(base>=0)&(hi>lo)&(cnt>0)
useful=ndimage.binary_dilation(useful,iterations=6)&(base>=0)
base=np.where(useful,base,-1)
big=np.array(Image.open(G+f'assets/maps/{MID}.jpg').convert('RGB'))
pieces=[]
for v in sorted(np.unique(base[base>=0])):
    mm=base==v
    l,n=ndimage.label(ndimage.binary_dilation(mm,iterations=6)); l=l*mm
    for i in np.unique(l[l>0]):
        c=l==i
        if c.sum()<20: continue
        ys,xs=np.where(c); x0,x1,y0,y1=max(0,xs.min()-1),min(1376,xs.max()+2),max(0,ys.min()-1),min(768,ys.max()+2)
        sub=c[y0:y1,x0:x1].astype(np.float32)
        a=cv2.GaussianBlur(cv2.resize(sub,((x1-x0)*2,(y1-y0)*2),interpolation=cv2.INTER_LINEAR),(0,0),0.7)
        im=np.dstack([big[y0*2:y1*2,x0*2:x1*2],(np.clip(a,0,1)*255).astype(np.uint8)])
        pieces.append(dict(x=int(x0),y=int(y0),w=int(x1-x0),h=int(y1-y0),baseY=int(v),img=im))
# shelf packing, tallest first
AW=4096; pad=2
order=sorted(range(len(pieces)),key=lambda k:-pieces[k]['img'].shape[0])
x=y=rowh=0
for k in order:
    h,w=pieces[k]['img'].shape[:2]
    if x+w+pad>AW: x=0; y+=rowh+pad; rowh=0
    pieces[k]['ax'],pieces[k]['ay']=x,y; x+=w+pad; rowh=max(rowh,h)
AH=y+rowh
AH2=1
while AH2<AH: AH2*=2
atlas=np.zeros((AH2,AW,4),np.uint8)
frames={}; objs=[]
for k,p in enumerate(pieces):
    h,w=p['img'].shape[:2]; atlas[p['ay']:p['ay']+h,p['ax']:p['ax']+w]=p['img']
    name=f'obj_{k:04d}'
    frames[name]={'frame':{'x':p['ax'],'y':p['ay'],'w':w,'h':h},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':w,'h':h},'sourceSize':{'w':w,'h':h}}
    objs.append({'frame':name,'x':p['x'],'y':p['y'],'w':p['w'],'h':p['h'],'baseY':p['baseY']})
out=G+'assets/maps/'
Image.fromarray(atlas).save(out+f'{MID}_objects.webp',quality=90,method=6)
Image.fromarray(atlas).save(out+f'{MID}_objects.png',optimize=True)
json.dump({'frames':frames,'meta':{'image':f'{MID}_objects.webp','size':{'w':AW,'h':AH2},'scale':1}},open(out+f'{MID}_objects_atlas.json','w'))
json.dump({'_설명':'맵 물건 조각(앞뒤 가림용) v3(새 그림체). 조각 그림은 아틀라스 한 장(webp, 같은 내용의 png도 있음 — 아이폰에서 webp 투명이 안 보이면 png로) + Phaser 아틀라스 JSON(_atlas.json). 좌표 x,y,w,h·baseY는 1376×768 기준, 그림은 2배 해상도라 w,h 크기로 줄여 그림. 깊이 = baseY, 캐릭터·몬스터·NPC·떨어진 물건의 깊이 = 발 y(발 y < baseY이면 조각이 앞). 기획 쪽 tools/art/village_objects_v3.py로 만듦.','atlas':f'assets/maps/{MID}_objects_atlas.json','image':f'assets/maps/{MID}_objects.webp','imagePng':f'assets/maps/{MID}_objects.png','image_scale':0.5,'objects':objs},open(out+f'{MID}_objects.json','w'),ensure_ascii=False,indent=0)
print(len(objs),AW,AH2)