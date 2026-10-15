# 새 무기 3종(Flow 47 쇠칼 시트) → assets/weapons/<id>.png
# 목검(v3_weapons.py)과 같은 규격: 캔버스 240×960, 쥐는 점 (120,800), 칼끝 위.
# 쥐는 점 = 손잡이 가운데(코등이와 손잡이 끝의 중간). 칼끝 거리(tipFromGrip)는 feedback_1015.md 7번 표(460/480/500)
# → 칼끝 y = 800 − tipFromGrip 이 되도록 배율을 정함. 시트 왼쪽부터 iron_rusty · iron_hwando · steel_hwando.
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from punch import segs
from PIL import Image
import numpy as np, json
G='/home/claude/seolhwa-rpg/'
A=G+'assets/weapons/'
sh=Image.open(G+'assets/source/v3/weapons_iron_sheet.jpg').convert('RGB')
ss=segs(sh); assert len(ss)==3, ss
ids=['iron_rusty','iron_hwando','steel_hwando']
T={'iron_rusty':460,'iron_hwando':480,'steel_hwando':500}
info={}
for name,(s0,e0) in zip(ids,ss):
    c=cutout(sh,(max(0,s0-10),0,min(sh.width,e0+10),sh.height))
    a=np.array(c)[...,3]>128; ys,xs=np.nonzero(a); k=np.polyfit(ys,xs,1)[0]; ang=np.degrees(np.arctan(k))
    if abs(ang)>0.3: c=c.rotate(-ang,resample=Image.BICUBIC,expand=True); c=c.crop(c.getbbox())
    a=np.array(c)[...,3]>128; h=a.shape[0]; wid=a.sum(1)
    lower=np.arange(int(h*0.55),int(h*0.85))
    guard=int(lower[np.argmax(wid[lower])])          # 코등이 = 아래쪽에서 가장 넓은 줄
    grip=(guard+h)/2                                  # 손잡이 가운데
    s=T[name]/grip
    c=c.resize((max(1,round(c.width*s)),round(h*s)),Image.LANCZOS)
    gy=round(grip*s)
    can=Image.new('RGBA',(240,960)); can.alpha_composite(c,(120-c.width//2,800-gy)); can.save(A+name+'.png',optimize=True)
    bb=can.getbbox()
    info[name]=dict(tipFromGrip=T[name],tipY=bb[1],buttY=bb[3],width=bb[2]-bb[0],guardFromTop=round(guard*s),tilt=round(float(ang),2))
print(json.dumps(info,indent=0))
v=json.load(open(A+'weapons_v3.json'))
for n,d in info.items(): v[n]=dict(tipFromGrip=d['tipFromGrip'],note='Flow 47 쇠칼 시트, 칼끝 = 800 − tipFromGrip (tools/art/v3_iron.py)')
json.dump(v,open(A+'weapons_v3.json','w'),indent=0,ensure_ascii=False)
