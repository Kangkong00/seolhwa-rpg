# 구간 4~9: 마을 사람 3명(갓방·포목점·방물장수, npc_sheet2) + 전리품 아이콘 12개(2026-10-19)
# 마을 사람: v3_npcs.py와 같은 규격(400×800, 발 780) · 같은 배율(첫 시트 5명 중 가장 큰 사람 = 740px)
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from v3_tier3_icons import items
from PIL import Image
import numpy as np, os, json
from scipy import ndimage
V='/home/claude/seolhwa-rpg/assets/source/v3/'; N='/home/claude/seolhwa-rpg/assets/npcs/'
def split(path,k):
    im=Image.open(V+path).convert('RGB'); a=np.array(im)
    fg=ndimage.binary_opening(a.min(2)<225,iterations=1); col=fg.sum(0)
    xs=np.nonzero(col>2)[0]; L,Rr=xs.min(),xs.max(); cuts=[L]
    for i in range(1,k):
        c=L+(Rr-L)*i/k; r=np.arange(int(c-90),int(c+90)); cuts.append(int(r[np.argmin(col[r])]))
    cuts.append(Rr+1)
    return [cutout(im,(max(0,cuts[i]-2),0,min(im.width,cuts[i+1]+2),im.height)) for i in range(k)]
s=740/max(f.height for f in split('npc_sheet.webp',5))
info={'scale':round(s,4)}
for i,f in zip(['hatmaker','cloth','peddler'],split('npc_sheet2.webp',3)):
    c=f.resize((round(f.width*s),round(f.height*s)),Image.LANCZOS)
    if c.width>398:   # 갓방 주인은 든 갓 때문에 넓음 → 캔버스 폭에 맞춰 조금 줄임(키 약 3% 작아짐)
        info['narrowed_'+i]=c.width; k=398/c.width; c=c.resize((398,round(c.height*k)),Image.LANCZOS)
    can=Image.new('RGBA',(400,800)); can.alpha_composite(c,(200-c.width//2,780-c.height))
    os.makedirs(N+i,exist_ok=True); can.save(N+i+'/front.png',optimize=True); info[i]=dict(h=c.height,w=c.width)
print(json.dumps(info))
R=items('items_loot_t4_9_sheet.webp',['loot_dog_hide','loot_dog_tooth','loot_raccoon_fur','loot_pebble','loot_fox_fur','loot_fox_bell',
    'loot_boar_meat','loot_boar_hide','loot_bear_hide','loot_honey','loot_wolf_hide','loot_wolf_fang'],2)
names=list(R); P=Image.new('RGBA',(6*130,2*130),(70,70,70,255))
for k,nm in enumerate(names): P.alpha_composite(R[nm].resize((128,128)),((k%6)*130,(k//6)*130))
P.convert('RGB').save('/home/claude/seolhwa-rpg/docs/tier4_9_loot_icons.png'); print(len(names),'icons')
