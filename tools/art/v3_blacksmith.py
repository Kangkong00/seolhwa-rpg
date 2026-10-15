# 새 그림체(v3) 대장장이(Flow 48) → assets/npcs/blacksmith/front.png
# v3_npcs.py와 같은 규격: 캔버스 400×800, 발 y=780, 가로 가운데.
# 배율은 다른 마을 사람 5명과 같게(시트 해상도가 같으므로 같은 s = 740 / 시트에서 가장 큰 사람 키).
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from PIL import Image
import numpy as np, os, json
from scipy import ndimage
V='/home/claude/seolhwa-rpg/assets/source/v3/'; N='/home/claude/seolhwa-rpg/assets/npcs/'
# 1) 기존 5명 시트의 배율 다시 구하기(v3_npcs.py와 같은 자르기)
im=Image.open(V+'npc_sheet.webp').convert('RGB'); a=np.array(im)
fg=ndimage.binary_opening(a.min(2)<225,iterations=1); col=fg.sum(0)
xs=np.nonzero(col>2)[0]; L,Rr=xs.min(),xs.max(); cuts=[L]
for k in range(1,5):
    c=L+(Rr-L)*k/5; r=np.arange(int(c-90),int(c+90)); cuts.append(int(r[np.argmin(col[r])]))
cuts.append(Rr+1)
figs=[cutout(im,(max(0,cuts[i]-2),0,min(im.width,cuts[i+1]+2),im.height)) for i in range(5)]
s=740/max(f.height for f in figs)
# 2) 대장장이
bs=Image.open(V+'npc_blacksmith.jpg').convert('RGB'); b=np.array(bs)
m=ndimage.binary_opening(b.min(2)<225,iterations=1); xs=np.nonzero(m.sum(0)>2)[0]
f=cutout(bs,(max(0,xs.min()-4),0,min(bs.width,xs.max()+5),bs.height))
c=f.resize((round(f.width*s),round(f.height*s)),Image.LANCZOS)
if c.width>400: print('WARN wide',c.width)
can=Image.new('RGBA',(400,800)); can.alpha_composite(c,(200-c.width//2,780-c.height))
os.makedirs(N+'blacksmith',exist_ok=True); can.save(N+'blacksmith/front.png',optimize=True)
gat=Image.open(N+'gatbachi/front.png'); gb=gat.getbbox()
print(json.dumps(dict(scale=round(s,4),sheetHeight=f.height,height=c.height,width=c.width,gatbachiHeight=gb[3]-gb[1])))
