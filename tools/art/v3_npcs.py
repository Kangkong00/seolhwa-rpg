# 새 그림체(v3) 마을 사람 5명 → assets/npcs/<id>/front.png
# 캔버스 400×800, 발 y=780, 가로 가운데. 5명 모두 같은 배율(서로 키 차이 유지): 가장 큰 사람(갓 포함) 키 = 740px.
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from PIL import Image
import numpy as np, os, json
from scipy import ndimage
V='/home/claude/seolhwa-rpg/assets/source/v3/'; N='/home/claude/seolhwa-rpg/assets/npcs/'
im=Image.open(V+'npc_sheet.webp').convert('RGB'); a=np.array(im)
fg=ndimage.binary_opening(a.min(2)<225,iterations=1); col=fg.sum(0)
xs=np.nonzero(col>2)[0]; L,Rr=xs.min(),xs.max()
# 사람 사이 4곳: 대략 5등분 자리 근처(±90)에서 가장 빈 세로줄
cuts=[L]
for k in range(1,5):
    c=L+(Rr-L)*k/5; r=np.arange(int(c-90),int(c+90)); cuts.append(int(r[np.argmin(col[r])]))
cuts.append(Rr+1)
ids=['gungwan','jumo','yakbang','gatbachi','chief']
figs=[cutout(im,(max(0,cuts[i]-2),0,min(im.width,cuts[i+1]+2),im.height)) for i in range(5)]
s=740/max(f.height for f in figs)
info={'cuts':cuts}
for i,f in zip(ids,figs):
    c=f.resize((round(f.width*s),round(f.height*s)),Image.LANCZOS)
    if c.width>400: print('WARN wide',i,c.width)
    can=Image.new('RGBA',(400,800)); can.alpha_composite(c,(200-c.width//2,780-c.height))
    os.makedirs(N+i,exist_ok=True); can.save(N+i+'/front.png'); info[i]=dict(height=c.height,width=c.width)
print(json.dumps(info,default=int))
