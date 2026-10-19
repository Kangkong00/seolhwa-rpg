# 구간 4~9 동물 12종 + 뱀 움직이기(2026-10-19) → assets/monsters/<id>/{front,side,back}[_step].png (640×400, 발 380)
# v3_monsters.py와 같은 방식: 정면 서 있기 키 240 기준, 움직이기 시트는 같은 배율. 옆모습은 왼쪽을 보게.
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from v3_monsters import boxes, fig, faces_right, place, segs
from PIL import Image, ImageOps
import os, json
V='/home/claude/seolhwa-rpg/assets/source/v3/'; M='/home/claude/seolhwa-rpg/assets/monsters/'
ids=['dog','dog_boss','raccoon','raccoon_boss','fox','fox_boss','boar','boar_boss','bear','bear_boss','tiger_boss','wolf']
cfg={i:(f'monster_{i}_turnaround.webp',f'monster_{i}_walk.webp') for i in ids}
cfg['snake']=(None,'monster_snake_walk.webp'); cfg['snake_boss']=(None,'monster_snakeboss_walk.webp')
log={}
for mid,(tf,wf) in cfg.items():
    os.makedirs(M+mid,exist_ok=True); info={}
    if tf:
        im=Image.open(V+tf).convert('RGB'); bx=boxes(im); fs=[fig(im,s,e,10) for s,e in bx]
        if faces_right(fs[1]): fs[1]=ImageOps.mirror(fs[1]); info['mirror']=True
        scale=240/fs[0].height
        for n,c in zip(['front','side','back'],fs): place(c,scale).save(M+mid+f'/{n}.png')
    else:
        a=Image.open(M+mid+'/front.png'); scale=None
    im=Image.open(V+wf).convert('RGB'); bx=boxes(im); fs=[fig(im,s,e,10) for s,e in bx]
    if faces_right(fs[1]): fs[1]=ImageOps.mirror(fs[1]); info['mirror_step']=True
    if scale is None:   # 뱀: 서 있기 그림의 몸 폭에 맞춤(움직이기는 몸을 펴서 키가 다름)
        st=Image.open(M+mid+'/side.png'); w0=st.getbbox()[2]-st.getbbox()[0]; scale=w0/fs[1].width*1.0
    for n,c in zip(['front','side','back'],fs):
        sc=scale
        if tf is None and n!='side':   # 뱀 앞뒤 움직이기: 몸이 세로로 접혀 작아 보이면 키 192(서 있기 240의 80%)까지 키움
            h=c.height*scale
            if h<180: sc=scale*192/h
        p=place(c,sc); bb=p.getbbox()
        if bb[0]==0 or bb[2]==640: info['edge_'+n]=bb
        p.save(M+mid+f'/{n}_step.png')
    log[mid]=info
print(json.dumps(log))
