# 구간 4~9 맵 13장(2026-10-19): 반짝이 지우고 assets/maps/<id>.jpg (2752×1536)
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
import numpy as np
from PIL import Image
from v3_maps import dewm, G
IDS=['back_mountain']+[f'dungeon_{a}_{n}' for a in ['dog','raccoon','fox','boar','bear','tiger'] for n in (1,2)]
for i in IDS:
    im=np.array(Image.open(G+f'assets/source/v3/{i}.jpg').convert('RGB').resize((2752,1536),Image.LANCZOS))
    out,n=dewm(im); Image.fromarray(out).save(G+f'assets/maps/{i}.jpg',quality=90); print(i,n)
