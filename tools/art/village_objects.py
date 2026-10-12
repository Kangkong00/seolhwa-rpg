# 마을 물건 조각(앞뒤 가림) 만들기 — 기획 쪽 도구
# 1) 원본 마을(assets/source/village_v2.jpg)과 Flow '빈 바닥판'(assets/source/village_v2_ground.jpg)을 맞춰(ECC) 색 차이로 물건 찾기
# 2) 픽셀마다 발 기준선 = 그 픽셀 아래 첫 '못 가는 칸' 덩어리의 아래끝(격자 data/maps/village.json). 아래에 못 가는 칸이 없으면 바닥에 놓인 납작한 물건(멍석 등) → 같은 줄 이웃 물건에서 120px 안이면 그 값, 아니면 가리지 않음
# 3) 캐릭터가 실제로 그 뒤에 설 수 있는 픽셀만 남겨(몸 높이 64px 안에 갈 수 있는 칸) 같은 기준선끼리 덩어리로 오려 webp + village_objects.json
# 경로 S는 그때그때 바꿔 씀. 순서: 아래 'STEP1' → objs 부분 → export 부분
import numpy as np, cv2
from PIL import Image
S='./'
# STEP1
from scipy import ndimage
import json, os
v=np.array(Image.open('/home/claude/seolhwa-rpg/assets/source/village_v2.jpg').convert('RGB'))
g=np.array(Image.open('/home/claude/seolhwa-rpg/assets/source/village_v2_ground.jpg').convert('RGB').resize((1376,768),Image.LANCZOS))
a=cv2.cvtColor(v,cv2.COLOR_RGB2GRAY).astype(np.float32); b=cv2.cvtColor(g,cv2.COLOR_RGB2GRAY).astype(np.float32)
W=np.eye(2,3,dtype=np.float32)
cc,W=cv2.findTransformECC(a,b,W,cv2.MOTION_AFFINE,(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,200,1e-6),None,5)
g2=cv2.warpAffine(g,W,(1376,768),flags=cv2.INTER_LINEAR+cv2.WARP_INVERSE_MAP,borderMode=cv2.BORDER_REPLICATE)
la=cv2.cvtColor(cv2.GaussianBlur(v,(0,0),1.5),cv2.COLOR_RGB2LAB).astype(float)
lb=cv2.cvtColor(cv2.GaussianBlur(g2,(0,0),1.5),cv2.COLOR_RGB2LAB).astype(float)
np.save(S+'diff.npy',np.sqrt(((la-lb)**2).sum(2)))
# ---- objs (기준선) ----
S='./'
G='/home/claude/seolhwa-rpg/'
T=26; BAND=4
d=np.load(S+'diff.npy')
m=d>T
m=ndimage.binary_opening(m,iterations=1)
m=ndimage.binary_closing(m,iterations=2)
# fill small holes only (keep yards open)
holes=ndimage.binary_fill_holes(m)&~m
hl,hn=ndimage.label(holes); hs=ndimage.sum(holes,hl,range(1,hn+1))
m|=np.isin(hl,1+np.where(hs<2500)[0])
lab,n=ndimage.label(m); sz=ndimage.sum(m,lab,range(1,n+1)); m=np.isin(lab,1+np.where(sz>=80)[0])
vm=json.load(open(G+'data/maps/village.json')); grid=vm['blocked']; cs=vm['cellSize']
def walk(x,y):
    r=int(y//cs); c=int(x//cs)
    if r<0 or r>=len(grid) or c<0 or c>=len(grid[0]): return False
    return grid[r][c]=='.'
# roofs/tree tops: thatch is close to dirt colour, so add the hand-made roof polygons
for o in vm['occluders']:
    if o.get('shape')=='poly':
        cv2.fillPoly(mu:=m.view(np.uint8), [np.array(o['points'],np.int32)], 1)
H,W=m.shape
blk=np.zeros((H,W),bool)
for r,row in enumerate(grid):
    for c,ch in enumerate(row):
        if ch=='#': blk[r*cs:(r+1)*cs, c*cs:(c+1)*cs]=True
base=np.full((H,W),-1,np.int32); flat=np.zeros((H,W),bool)
for x in range(W):
    nb=np.full(H,-1,np.int32); cur=-1
    for y in range(H-1,-1,-1):
        if blk[y,x]:
            if y==H-1 or not blk[y+1,x]: cur=y   # bottom of a blocked segment
            nb[y]=cur
        else:
            nb[y]=cur if cur>=0 else -1
        # nb[y] = bottom of first blocked segment at/below y
    col=m[:,x]; y=0
    while y<H:
        if col[y]:
            s=y
            while y<H and col[y]: y+=1
            e=y-1
            for yy in range(s,e+1):
                b=nb[yy]
                if b<0 or b>e+12: flat[yy,x]=True
                else: base[yy,x]=b
        else: y+=1
obj=(base>=0)
np.save(S+'base.npy',base); np.save(S+'flat.npy',flat)
print('object px',obj.mean(),'flat px',flat.mean())
vis=np.array(Image.open(G+'assets/source/village_v2.jpg').convert('RGB')).copy()
vis[flat]=(vis[flat]*0.4+np.array([0,120,255])*0.6).astype(np.uint8)
ov=obj.copy(); 
hue=(base%64)*4
col=cv2.applyColorMap(hue.astype(np.uint8),cv2.COLORMAP_HSV)[...,::-1]
vis[ov]=(vis[ov]*0.5+col[ov]*0.5).astype(np.uint8)
Image.fromarray(vis).save(S+'objs_vis.jpg')
# --- fill flat pixels from horizontal neighbours in the same component (tree canopy edges, doorway gaps)
allm=(base>=0)|flat
lab,n=ndimage.label(allm)
base2=base.copy()
R=120
for y in range(H):
    row=base[y]; fl=np.where(flat[y])[0]
    if len(fl)==0: continue
    good=np.where(row>=0)[0]
    if len(good)==0: continue
    for x in fl:
        i=np.searchsorted(good,x); best=None
        for j in (i-1,i):
            if 0<=j<len(good):
                gx=good[j]
                if abs(gx-x)<=R and lab[y,gx]==lab[y,x]:
                    if best is None or abs(gx-x)<abs(best-x): best=gx
        if best is not None: base2[y,x]=row[best]
base=base2
# pixels below their own footprint line never overlap a character standing behind it -> drop
yy=np.arange(H)[:,None].repeat(W,1)
base[(base>=0)&(yy>base+2)]=-1
np.save(S+'base2.npy',base)
vis=np.array(Image.open(G+'assets/source/village_v2.jpg').convert('RGB')).astype(float)
o=base>=0
hue=((base//4)%32*8).astype(np.uint8)
col=cv2.applyColorMap(hue,cv2.COLORMAP_JET)[...,::-1]
vis[o]=vis[o]*0.45+col[o]*0.55
Image.fromarray(vis.astype(np.uint8)).save(S+'objs_vis2.jpg')
print('occluding px',o.mean())
# ---- export (조각 내보내기) ----
# 마을 물건 조각 내보내기: base2.npy(픽셀별 발 기준선, 1376 좌표) -> 같은 기준선끼리 이어진 덩어리마다 조각
S='./'
G='/home/claude/seolhwa-rpg/'
OUT=G+'assets/maps/village_objects/'
os.makedirs(OUT,exist_ok=True)
for f in os.listdir(OUT): os.remove(OUT+f)
base=np.load(S+'base2.npy')
# keep only pixels that a character could ever be behind: a walkable spot (±16px across) between the pixel and its base, within one body height (64px) below it
vm=json.load(open(G+'data/maps/village.json')); grid=vm['blocked']; cs=vm['cellSize']
wk=np.zeros((768,1376),bool)
for r,row in enumerate(grid):
    for c,ch in enumerate(row):
        if ch=='.': wk[r*cs:(r+1)*cs,c*cs:(c+1)*cs]=True
wk=ndimage.maximum_filter(wk,size=(1,33))
cum=np.vstack([np.zeros((1,1376),np.int32),np.cumsum(wk,0)])
H=768; yy=np.arange(H)[:,None]
lo=np.clip(yy+1,0,H); hi=np.clip(np.minimum(yy+64,base),0,H)
cnt=np.take_along_axis(cum,np.clip(hi,0,H),0)-np.take_along_axis(cum,np.broadcast_to(lo,base.shape),0)
useful=(base>=0)&(hi>lo)&(cnt>0)
print('kept',useful.sum()/(base>=0).sum())
base=np.where(useful,base,-1)
big=np.array(Image.open(G+'assets/maps/village.jpg').convert('RGB'))  # 2752x1536
items=[]; k=0
for v in sorted(np.unique(base[base>=0])):
    m=base==v
    lab,n=ndimage.label(m,structure=np.ones((3,3)))
    for i in range(1,n+1):
        c=lab==i
        if c.sum()<30: continue
        ys,xs=np.where(c); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
        x0=max(0,x0-1);y0=max(0,y0-1);x1=min(1376,x1+1);y1=min(768,y1+1)
        sub=c[y0:y1,x0:x1].astype(np.float32)
        a=cv2.resize(sub,((x1-x0)*2,(y1-y0)*2),interpolation=cv2.INTER_LINEAR)
        a=cv2.GaussianBlur(a,(0,0),0.7)
        rgb=big[y0*2:y1*2,x0*2:x1*2]
        im=np.dstack([rgb,(np.clip(a,0,1)*255).astype(np.uint8)])
        name=f'obj_{k:03d}.webp'; Image.fromarray(im).save(OUT+name,quality=88,method=6)
        items.append({'file':name,'x':int(x0),'y':int(y0),'w':int(x1-x0),'h':int(y1-y0),'baseY':int(v)})
        k+=1
json.dump({'_설명':'마을 물건 조각(앞뒤 가림용). 좌표는 1376×768 기준, 그림은 2배(2752 기준) 해상도라 0.5배로 그림. 조각을 (x,y)에 놓고 깊이 = baseY. 캐릭터·몬스터·NPC의 깊이 = 발 y. 발 y < baseY이면 조각이 앞(캐릭터를 가림). 마을 그림 위에 같은 자리로 겹치므로 평소엔 티가 안 남. 기획 쪽 tools/art/village_objects.py로 만듦(원본 마을과 Flow 빈 바닥판 비교 + 격자로 발 기준선).','image_scale':0.5,'objects':items},open(G+'assets/maps/village_objects.json','w'),ensure_ascii=False,indent=0)
print(k)
