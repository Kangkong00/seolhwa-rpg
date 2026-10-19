# 정밀 격자(2026-10-20 강콩: "맵이 정교하지 않음, 몬스터가 벽·바위 위를 걸음")
# 바닥 다각형(눈으로 25px 단위로 땀) → GrabCut으로 그림 테두리(먹선)에 맞춰 픽셀 단위로 다듬음 → 4px 칸(344×192)
# 다각형 밖 = 확실히 벽, 다각형 안쪽 깊은 곳 = 확실히 바닥, 테두리 ±R px = GrabCut이 정함. CUT = 바닥 위 물건(바위·웅덩이·뼈 더미)
import numpy as np, cv2, json, sys, importlib
from PIL import Image, ImageDraw
from scipy import ndimage
G='/home/claude/seolhwa-rpg/'
CS=4; W,H=1376,768
def poly_mask(polys,shape=(H,W)):
    m=Image.new('L',(shape[1],shape[0]),0); d=ImageDraw.Draw(m)
    for p in polys: d.polygon(p,fill=255)
    return np.array(m)>0
def refine(mid,add,cut=(),band=6,keep_pts=(),force=()):
    im=np.array(Image.open(G+f'assets/maps/{mid}.jpg').convert('RGB').resize((W,H),Image.LANCZOS))
    A=add if isinstance(add,np.ndarray) else poly_mask(add); C=poly_mask(cut) if cut else np.zeros_like(A)
    rough=A&~C
    k=np.ones((3,3),np.uint8)
    inner=cv2.erode(rough.astype(np.uint8),k,iterations=band)>0
    outer=cv2.dilate(rough.astype(np.uint8),k,iterations=band)>0
    mask=np.full((H,W),cv2.GC_BGD,np.uint8)
    mask[outer]=cv2.GC_PR_BGD; mask[rough]=cv2.GC_PR_FGD; mask[inner]=cv2.GC_FGD
    bgd=np.zeros((1,65),np.float64); fgd=np.zeros((1,65),np.float64)
    cv2.grabCut(cv2.cvtColor(im,cv2.COLOR_RGB2BGR),mask,None,bgd,fgd,4,cv2.GC_INIT_WITH_MASK)
    fl=(mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD)
    fl=ndimage.binary_opening(fl,iterations=1)
    if force: fl|=poly_mask(force)   # 입구 앞 길처럼 어두워도 꼭 걸어야 하는 곳
    return im,fl
def to_cells(fl,keep_pts=()):
    c=fl.reshape(H//CS,CS,W//CS,CS).mean((1,3))>0.6     # 칸의 60% 넘게 바닥이어야 갈 수 있음
    c=ndimage.binary_opening(c,iterations=1)
    for x,y in keep_pts:   # 입구·도착 자리는 반드시 열어 둠
        cx,cy=x//CS,y//CS; c[max(0,cy-3):cy+4,max(0,cx-5):cx+6]=True
    l,n=ndimage.label(c); 
    if n>1:
        sz=ndimage.sum(c,l,range(1,n+1)); c=l==(1+np.argmax(sz))
    return c
def save(mid,im,c,marks):
    open(G+f'docs/map_drafts/{mid}_blocked.txt','w').write('\n'.join(''.join('.' if x else '#' for x in row) for row in c)+'\n')
    big=np.kron(c,np.ones((CS,CS),bool)); v=im.copy(); v[~big]=(v[~big]*0.45+np.array([160,0,0])*0.55).astype(np.uint8)
    vis=Image.fromarray(v); d=ImageDraw.Draw(vis)
    for col,pts in marks:
        for x,y in pts: d.ellipse((x-9,y-9,x+9,y+9),outline=col,width=3)
    vis.save(G+f'docs/map_drafts/{mid}_grid.jpg',quality=82)
    return int(c.sum())
if __name__=='__main__':
    P=importlib.import_module('grid_fine_polys')
    ids=sys.argv[1:] or list(P.MAPS)
    for mid in ids:
        m=P.MAPS[mid]
        if m.get('fromGrid'):   # 이미 손본 8px 격자를 대충 바닥으로 보고 테두리만 다듬음
            d=json.load(open(G+f'data/maps/{mid}.json')); cs=d['cellSize']
            b=np.array([[ch=='.' for ch in r] for r in d['blocked']])
            m=dict(m); m['add']=np.kron(b,np.ones((cs,cs),bool))[:H,:W]
        im,fl=refine(mid,m['add'],m.get('cut',()),force=m.get('force',()))
        pts=[p for p in m.get('keep',[])]
        c=to_cells(fl,pts)
        bad=[p for p in pts if not c[p[1]//CS,p[0]//CS]]
        n=save(mid,im,c,[((255,255,0),pts)])
        print(mid,n,'cells(4px)','BAD' if bad else 'ok',bad)
