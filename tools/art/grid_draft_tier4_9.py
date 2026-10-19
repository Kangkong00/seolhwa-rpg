# 구간 4~9 맵 13장 격자 초안(2026-10-19) = 밝기(바닥이 벽보다 밝음, Otsu) + 입구 앞 이어 붙이기 다각형, 가장 큰 덩어리만.
# 정확하지 않음: 벽 앞면(밝은 절벽)이 갈 수 있게 잡힌 곳이 있음 → 게임 격자 편집(G)으로 고침.
# 결과: docs/map_drafts/<id>_blocked.txt(# 막힘 . 갈 수 있음, 96줄×172칸) + _grid.jpg(초록=도착, 노랑=입구, 보라=우두머리)
import numpy as np, cv2, json
from PIL import Image, ImageDraw
from scipy import ndimage
G='/home/claude/seolhwa-rpg/'
def R(x0,y0,x1,y1): return [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
BOSS1=lambda x,y:{'to2':(x,y)}
M={
 'back_mountain':dict(arrive=(690,700),portals=[('대숲',(690,752)),('여우굴',(370,262)),('곰굴',(380,486)),('산군굴',(758,196)),('멧돼지굴',(1130,392))],
   add=[R(640,600,745,768),[(320,262),(460,240),(520,300),(380,310)],[(330,480),(450,470),(470,540),(340,540)],[(715,180),(805,180),(830,250),(690,250)],[(1070,380),(1190,370),(1200,440),(1060,440)]]),
 'dungeon_dog_1':dict(arrive=(700,300),portals=[('폐가',(700,222)),('개왕의 방',(1150,262))],add=[R(640,200,770,260),[(1030,290),(1100,240),(1220,240),(1230,300),(1080,330)]]),
 'dungeon_dog_2':dict(arrive=(310,580),portals=[('들개 소굴',(185,548))],boss=(760,450),add=[[(140,560),(300,520),(380,560),(300,640),(160,620)]]),
 'dungeon_raccoon_1':dict(arrive=(680,680),portals=[('대숲',(680,744)),('둔갑 너구리의 방',(955,222))],add=[R(620,640,760,768),[(860,220),(1040,220),(1000,300),(880,300)]]),
 'dungeon_raccoon_2':dict(arrive=(340,600),portals=[('너구리굴',(245,530))],boss=(760,420),add=[[(200,540),(330,520),(380,600),(250,640),(200,600)]]),
 'dungeon_fox_1':dict(arrive=(700,640),portals=[('뒷산 오솔길',(700,705)),('구미호의 방',(1040,222))],add=[R(630,600,780,740),[(950,230),(1120,230),(1100,290),(950,290)]]),
 'dungeon_fox_2':dict(arrive=(340,600),portals=[('여우굴',(225,510))],boss=(770,420),add=[[(180,520),(320,520),(400,600),(260,630),(180,590)]]),
 'dungeon_boar_1':dict(arrive=(690,640),portals=[('뒷산 오솔길',(690,566)),('산저의 방',(1150,262))],add=[R(630,550,760,660),[(1030,290),(1100,240),(1220,240),(1230,300),(1080,330)]]),
 'dungeon_boar_2':dict(arrive=(300,560),portals=[('멧돼지굴',(150,585))],boss=(700,420),add=[[(80,540),(300,520),(320,620),(100,640)]]),
 'dungeon_bear_1':dict(arrive=(690,640),portals=[('뒷산 오솔길',(690,725)),('흑웅의 방',(1050,232))],add=[R(630,600,750,760),[(960,260),(1120,250),(1100,310),(950,310)]]),
 'dungeon_bear_2':dict(arrive=(330,590),portals=[('곰굴',(185,545))],boss=(700,460),add=[[(140,560),(300,540),(400,600),(260,640),(150,610)]]),
 'dungeon_tiger_1':dict(arrive=(700,620),portals=[('뒷산 오솔길',(700,705)),('산군의 방',(1050,212))],add=[R(620,590,780,740),[(960,240),(1120,240),(1100,310),(940,310)]]),
 'dungeon_tiger_2':dict(arrive=(380,620),portals=[('산군굴',(205,600))],boss=(700,520),add=[[(150,560),(320,560),(420,600),(400,680),(180,680)]]),
}
out={}
for mid,mk in M.items():
    im=np.array(Image.open(G+f'assets/maps/{mid}.jpg').convert('RGB').resize((1376,768),Image.LANCZOS))
    L=cv2.GaussianBlur(cv2.cvtColor(im,cv2.COLOR_RGB2LAB)[...,0].astype(float),(0,0),6)
    cells=L.reshape(96,8,172,8).mean((1,3))
    t,_=cv2.threshold(cells.astype(np.uint8),0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    fl=ndimage.binary_opening(cells>t,iterations=1)
    m=Image.new('L',(1376,768),0); d=ImageDraw.Draw(m)
    for p in mk['add']: d.polygon(p,fill=255)
    fl|=np.array(m).reshape(96,8,172,8).mean((1,3))>127
    fl[:,0]=fl[:,-1]=False; fl[0]=fl[-1]=False
    l,n=ndimage.label(fl); sz=ndimage.sum(fl,l,range(1,n+1)); main=l==(1+np.argmax(sz))
    # 입구·도착·우두머리 자리마다 작은 바닥 + 가장 가까운 큰 바닥까지 폭 3칸 길을 이어 붙임(끊기지 않게)
    pts=[p for _,p in mk['portals']]+[mk['arrive']]+([mk['boss']] if 'boss' in mk else [])
    ys,xs=np.nonzero(main); g=Image.fromarray((main*255).astype('uint8')); dg=ImageDraw.Draw(g)
    for x,y in pts:
        cx,cy=x//8,min(94,y//8); k=np.argmin((ys-cy)**2+(xs-cx)**2)
        dg.line((cx,cy,xs[k],ys[k]),fill=255,width=3); dg.rectangle((cx-3,cy-2,cx+3,cy+2),fill=255)
    fl=np.array(g)>0
    chk={nm:bool(fl[min(95,y//8),x//8]) for nm,(x,y) in mk['portals']}; chk['도착']=bool(fl[mk['arrive'][1]//8,mk['arrive'][0]//8])
    if 'boss' in mk: chk['우두머리']=bool(fl[mk['boss'][1]//8,mk['boss'][0]//8])
    open(G+f'docs/map_drafts/{mid}_blocked.txt','w').write('\n'.join(''.join('.' if x else '#' for x in row) for row in fl)+'\n')
    big=np.kron(fl,np.ones((8,8),bool)); im[~big]=(im[~big]*0.45+np.array([160,0,0])*0.55).astype(np.uint8)
    vis=Image.fromarray(im); dv=ImageDraw.Draw(vis)
    x,y=mk['arrive']; dv.ellipse((x-8,y-8,x+8,y+8),outline=(0,255,0),width=3)
    for nm,(x,y) in mk['portals']: dv.ellipse((x-16,y-10,x+16,y+10),outline=(255,255,0),width=3)
    if 'boss' in mk: x,y=mk['boss']; dv.ellipse((x-12,y-12,x+12,y+12),outline=(255,0,255),width=3)
    vis.save(G+f'docs/map_drafts/{mid}_grid.jpg',quality=80)
    out[mid]=dict(cells=int(fl.sum()),**{k:v for k,v in chk.items()})
print(json.dumps(out,ensure_ascii=False,indent=0))
