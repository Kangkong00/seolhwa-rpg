# 구간 3(뱀굴) 그림: 맵 2장(2752×1536 + 반짝이 지움), 물뱀·늙은 구렁이(서 있기 3방향, 걷기 그림이 오기 전엔 서 있기를 걷기로 복사), 패랭이 아이콘
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
import numpy as np, os, json, shutil
from PIL import Image, ImageOps
from v3_maps import dewm
from v3_monsters import boxes, fig, faces_right, place, segs
G='/home/claude/seolhwa-rpg/'; V=G+'assets/source/v3/'; M=G+'assets/monsters/'
for src in ['dungeon_snake_1.jpg','dungeon_snake_2.jpg']:
    im=np.array(Image.open(V+src).convert('RGB').resize((2752,1536),Image.LANCZOS))
    out,n=dewm(im); Image.fromarray(out).save(G+'assets/maps/'+src,quality=90); print(src,'watermark px',n)
log={}
for mid,f in [('snake','monster_snake_turnaround.webp'),('snake_boss','monster_snakeboss_turnaround.jpg')]:
    os.makedirs(M+mid,exist_ok=True)
    im=Image.open(V+f).convert('RGB'); bx=boxes(im); fs=[fig(im,s,e,10) for s,e in bx]
    fr=faces_right(fs[1])
    if fr: fs[1]=ImageOps.mirror(fs[1])
    s=240/fs[0].height
    for n,c in zip(['front','side','back'],fs):
        p=place(c,s); p.save(M+mid+f'/{n}.png'); shutil.copy(M+mid+f'/{n}.png',M+mid+f'/{n}_step.png')
    log[mid]=dict(mirror=bool(fr),scale=round(s,3))
print(log)
# 패랭이 아이콘(옆모습이 알아보기 쉬움)
from v3_tier3_icons import fit
fit(Image.open(G+'assets/equipment/head/paraengi/side.png'),'hat_paraengi')
