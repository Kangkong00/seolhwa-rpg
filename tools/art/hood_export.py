# 머리 장비·상투 지우개·위치값을 저장소 assets/equipment/head/ 로 내보냄
import json, os, shutil, pickle, numpy as np
from PIL import Image
S='/tmp/claude-0/-home-claude-seolhwa-rpg/1798b720-9bbd-5e1d-af87-0516171baaa5/scratchpad/'
G='/home/claude/seolhwa-rpg/'
H=G+'assets/equipment/head/'
os.makedirs(H+'hood_mumyeong/topknot',exist_ok=True)
for d in ['front','side','back']: shutil.copy(S+f'hood2_{d}.png',H+f'hood_mumyeong/{d}.png')
al=json.load(open(S+'hood_align.json'))
masks=pickle.load(open(S+'masks.pkl','rb'))
anchor={"_설명":"머리 장비를 몸 그림에 붙이는 위치(모자 종류와 무관, 옷·자세별). 머리 장비 그림은 서 있기 캔버스(400×720) 기준으로 그려져 있음. 장비 그림의 from 점을 몸 그림 캔버스의 to 점에 맞추고, rotDeg(시계 방향 +)만큼 돌리고 scale배 함. 서 있기·걷기는 그대로 겹침(from=to). 기획 쪽이 tools/art/hood.py로 자동 측정"}
for outfit in sorted(os.listdir(G+'assets/characters')):
    for f in sorted(os.listdir(G+f'assets/characters/{outfit}')):
        if not f.endswith('.png'): continue
        n=f[:-4]
        if n.endswith('_hand'): continue
        k=f'{outfit}/{n}'
        if k in al: v=al[k]; anchor[k]={"from":[float(x) for x in v['from']],"to":v['to'],"rotDeg":v['rotDeg'],"scale":v['scale']}
        else: anchor[k]={"from":[200,200],"to":[200,200],"rotDeg":0,"scale":1}
        m=masks[G+f'assets/characters/{outfit}/{f}']
        os.makedirs(H+f'hood_mumyeong/topknot/{outfit}',exist_ok=True)
        a=np.zeros(m.shape+(4,),np.uint8); a[m]=(255,255,255,255)
        Image.fromarray(a).save(H+f'hood_mumyeong/topknot/{outfit}/{n}.png',optimize=True)
json.dump(anchor,open(H+'head_anchor.json','w'),ensure_ascii=False,indent=1)
print(len(anchor)-1)
