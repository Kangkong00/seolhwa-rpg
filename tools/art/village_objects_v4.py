# 맵 물건 조각(앞뒤 가림) v4(2026-10-21 강콩: 물건 뒤로 가면 너무 반듯하게 잘리거나 빈 네모가 보임).
# v3와 다른 점: 픽셀마다 계단식 기준선(8px 올림·최빈값) 대신 **물건이 서 있는 못 가는 칸 덩어리(발판)마다** 기준선 = 그 발판의 아래끝 윤곽(±12px 최대값으로 매끈하게, 4px 단위).
#   같은 집 지붕·벽은 한 기준선 → 몸이 가로로 반듯하게 잘리지 않음. '뒤에 설 수 있는 곳만 남기기'(네모 구멍의 원인)를 뺌.
# 원래 v3 설명: 사용: python3 village_objects_v3.py [맵 id] (기본 village, 예: dungeon_rat_1)
# 필요한 것: data/maps/<id>.json 격자, 원본 assets/source/v3/<id>.jpg, 빈 바닥판 assets/source/v3/<id>_ground.jpg
# 순서: 1) 새 마을 그림(1376으로 줄임) vs 빈 바닥판(ECC로 맞춤) 색 차이  2) 격자로 픽셀별 발 기준선  3) 8px 올림·최빈값 다듬기  4) 아틀라스
# 지붕(초가 = 흙색이라 차이가 약함)은 옛 손 다각형(village_old_occluders.json)을 더함 — 새 그림도 위치가 같음(ECC 어긋남 < 0.2px)
import numpy as np, cv2, json, os, shutil, sys
from PIL import Image
G='/home/claude/seolhwa-rpg/'

MID=sys.argv[1] if len(sys.argv)>1 else 'village'
S=f'/tmp/vo4_{MID}/'; os.makedirs(S,exist_ok=True)
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
# ---- 1-1) v4: 물건 픽셀 = 차이 마스크 중 v3 조각 둘레 24px 안(뒤에 설 수 있는 물건만) − 갈 수 있는 칸 위의 땅(흙·풀, 먹선·무늬 없음)
cov=np.load('/tmp/vo3old/cov.npy') if os.path.exists('/tmp/vo3old/cov.npy') else None
# (v3 조각 둘레로 줄이는 것은 뺌 — 네모 구멍이 그대로 옮겨옴)
wk=~blk
dirtgrass=groundish(V)&groundish(Gp)&~ink&(tex<8)&(d<30)   # 지붕(초가)은 바닥판과 차이가 커서 남음
roofm=roof.astype(bool)   # 초가지붕은 흙색·무늬 적어도 지움 대상에서 빼기
m&=~(wk&dirtgrass&~roofm)
m&=~(wk&~ink&(tex<6)&groundish(V)&~roofm)   # 갈 수 있는 칸 위의 무늬 없는 흙·풀(그림자 진 마당 포함)
m=ndimage.binary_opening(m,iterations=1)
hl0,hn0=ndimage.label(ndimage.binary_fill_holes(m)&~m)
if hn0:
    hs0=ndimage.sum(np.ones_like(hl0),hl0,range(1,hn0+1)); m|=np.isin(hl0,1+np.where(hs0<600)[0])   # 지붕 속 작은 구멍 메움
lab0,n0=ndimage.label(m); sz0=ndimage.sum(m,lab0,range(1,n0+1)); m=np.isin(lab0,1+np.where(sz0>=80)[0])
# ---- 2) 기준선(v4): 발판 = 못 가는 칸 덩어리 ----
# 못 가는 칸 덩어리의 '아래 가장자리 선'(못 가는 칸인데 바로 아래가 갈 수 있는 칸) = 물건이 땅에 닿는 선
edge=blk&np.vstack([~blk[1:],np.ones((1,W),bool)])   # 맵 맨 아래도 땅에 닿는 선
# 선을 이어 붙임(격자 계단 8px 넘나들게 세로로 10px까지 이음) → 선마다 번호
eL,ne=ndimage.label(ndimage.binary_dilation(edge,structure=np.ones((11,3),bool))); eL=eL*edge
# 선마다 x별 y(여러 개면 가장 아래) → ±12px 최대값 → 4px 올림 = 그 선의 기준선
prof=np.full((ne+1,W),-1,np.int32)
ys,xs=np.nonzero(edge); np.maximum.at(prof,(eL[ys,xs],xs),ys)
profs=prof.copy()
for L in range(1,ne+1):
    b=prof[L]
    if (b<0).all(): continue
    mf=ndimage.maximum_filter1d(b,size=25)
    profs[L]=np.where(mf>=0,(mf+3)//4*4,-1)
# 물건 픽셀마다: 그 열에서 자기 아래(자기 자리 포함) 처음 만나는 '아래 가장자리 선'
fe=np.zeros((H,W),np.int32); fey=np.full((H,W),-1,np.int32)
for x in range(W):
    idx=np.nonzero(eL[:,x])[0]
    if len(idx)==0: continue
    yy=np.arange(H); j=np.searchsorted(idx,yy); ok=j<len(idx); jj=np.minimum(j,len(idx)-1)
    fe[:,x]=np.where(ok,eL[idx[jj],x],0); fey[:,x]=np.where(ok,idx[jj],-1)
openc=np.vstack([np.zeros((1,W),np.int32),np.cumsum(~blk,0)])   # 열마다 갈 수 있는 칸 누계
base=np.full((H,W),-1,np.int32)
for x in range(W):
    col=m[:,x]; y=0
    while y<H:
        if col[y]:
            s0=y
            while y<H and col[y]: y+=1
            e=y-1
            L=fe[s0:e+1,x]; ly=fey[s0:e+1,x]
            # 발판 선이 물건 아래끝 12px 안이거나, 물건 아래끝부터 그 선까지 모두 못 가는 칸(사이에 설 수 없음)
            between=openc[np.clip(ly,0,H),x]-openc[min(e+1,H),x]
            ok=(L>0)&(ly>=0)&((ly<=e+12)|(between<=0))
            v=np.where(ok,profs[L,x],-1)
            base[s0:e+1,x]=np.where(v>=np.arange(s0,e+1),v,-1)
        else: y+=1
# 기준선은 그 열에서 물건 그림이 이어진 아래끝(+6, 4px 올림)을 넘지 않게 — 격자 칸이 그림보다 아래로 길면 물건 앞에 선 사람의 몸 가운데를 덮던 문제
rb=np.full((H,W),-1,np.int32)
for x in range(W):
    col=m[:,x]; y=0
    while y<H:
        if col[y]:
            s0=y
            while y<H and col[y]: y+=1
            rb[s0:y,x]=y-1
        else: y+=1
cap=np.where(rb>=0,(rb+6+3)//4*4,-1)
base=np.where((base>=0)&(cap>=0),np.minimum(base,cap),base)
# 나무 그늘·처마 끝처럼 발판 위가 아닌 물건 픽셀: 같은 덩어리·같은 줄의 가까운(120px) 픽셀 기준선을 빌림
lab,n=ndimage.label(m)
b2=base.copy()
for y in range(H):
    need=np.nonzero(m[y]&(base[y]<0))[0]
    if len(need)==0: continue
    good=np.nonzero(base[y]>=0)[0]
    if len(good)==0: continue
    for x in need:
        i=np.searchsorted(good,x); best=None
        for jx in (i-1,i):
            if 0<=jx<len(good):
                gx=good[jx]
                if abs(gx-x)<=120 and lab[y,gx]==lab[y,x] and (best is None or abs(gx-x)<abs(best-x)): best=gx
        if best is not None: b2[y,x]=base[y,best]
base=b2
# 한 덩어리 안 작은 얼룩(같은 발판인데 기준선이 이웃과 다른 점) 정리: 5×5 최빈값
q=base.copy(); o=q>=0
for v in np.unique(q[o]):
    pass
print('object px',int(m.sum()),'based',int((base>=0).sum()))
np.save('/tmp/vo4_m.npy',m); np.save('/tmp/vo4_base.npy',base)
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
json.dump({'_설명':'맵 물건 조각(앞뒤 가림용) v4(2026-10-21, 발판마다 한 기준선). 조각 그림은 아틀라스 한 장(webp, 같은 내용의 png도 있음 — 아이폰에서 webp 투명이 안 보이면 png로) + Phaser 아틀라스 JSON(_atlas.json). 좌표 x,y,w,h·baseY는 1376×768 기준, 그림은 2배 해상도라 w,h 크기로 줄여 그림. 깊이 = baseY, 캐릭터·몬스터·NPC·떨어진 물건의 깊이 = 발 y(발 y < baseY이면 조각이 앞). 기획 쪽 tools/art/village_objects_v4.py로 만듦.','atlas':f'assets/maps/{MID}_objects_atlas.json','image':f'assets/maps/{MID}_objects.webp','imagePng':f'assets/maps/{MID}_objects.png','image_scale':0.5,'objects':objs},open(out+f'{MID}_objects.json','w'),ensure_ascii=False,indent=0)
print(len(objs),AW,AH2)