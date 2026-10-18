# 모자 시안: 옷 6벌 × 서 있기 3방향·들고 서 있기·치켜들기·내려치기·휘두르기(뒷면) — 두건과 같은 head_anchor·상투 지우개 사용
# 쓰는 법: python3 hat_mock.py <모자 폴더 이름>  → docs/hat_<이름>_test.png
import json, sys, numpy as np
from PIL import Image
G='/home/claude/seolhwa-rpg/'; AN=json.load(open(G+'assets/equipment/head/head_anchor.json')); HD=sys.argv[1]
def to640(im):
    if im.width==640: return im
    c=Image.new('RGBA',(640,720)); c.alpha_composite(im,(120,0)); return c
def wear(o,n):
    b=Image.open(G+f'assets/characters/{o}/{n}.png').convert('RGBA'); a=AN[f'{o}/{n}']
    tk=np.array(Image.open(G+f'assets/equipment/head/hood_mumyeong/topknot/{o}/{n}.png').convert('RGBA'))[...,3]
    ba=np.array(b); ba[tk>0,3]=0; b=Image.fromarray(ba)
    hd=Image.open(G+f'assets/equipment/head/{HD}/'+n.split('_')[0]+'.png').convert('RGBA')
    s=a['scale']; big=Image.new('RGBA',(1400,1400)); fx,fy=a['from']; big.alpha_composite(hd,(int(700-fx),int(700-fy)))
    big=big.resize((round(1400*s),)*2).rotate(-a['rotDeg'],center=(700*s,700*s))
    tx,ty=a['to']; L=Image.new('RGBA',b.size); L.alpha_composite(big,(int(tx-700*s),int(ty-700*s)))
    b.alpha_composite(L); return to640(b)
OUT=['outfit1_hotot','outfit2_mumyeong','outfit3_dopo','outfit4_cheollik','outfit5_dujeonggap','outfit6_sinseon']
P=['front','side','back','front_hold','front_raise','side_strike','back_swing']
sh=Image.new('RGB',(len(P)*220,len(OUT)*250),(150,170,150))
for r,o in enumerate(OUT):
    for c,n in enumerate(P):
        t=Image.new('RGBA',(640,720),(150,170,150,255)); t.alpha_composite(wear(o,n))
        sh.paste(t.crop((100,0,540,500)).convert('RGB').resize((220,250)),(c*220,r*250))
sh.save(G+f'docs/hat_{HD}_test.png')
