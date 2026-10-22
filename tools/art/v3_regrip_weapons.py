# 2026-10-23: 술 달린 무기가 손잡이가 아니라 "그림 전체 가운데"로 맞춰져 쥐는 점(120,800)에서 벗어남 → 손잡이 축을 x=120으로 옮김
# 손잡이 가운데 = 750~800줄에서 칼날 축과 가장 가까운 연속 구간의 가운데. 오른쪽으로 밀려 잘리는 술 끝은 24px 흐리게.
from PIL import Image
import numpy as np, json, sys
D='/home/claude/seolhwa-rpg/'
W=json.load(open(D+'data/weapons.json'))['weapons']
W=dict(W) if isinstance(W,dict) else {x['id']:x for x in W}
def handle_cx(a):
    ys=np.nonzero(a.any(1))[0]; t=ys.min()
    bc=np.median([(np.nonzero(a[y])[0].min()+np.nonzero(a[y])[0].max())/2 for y in range(t+60,700,8) if a[y].any()])
    hs=[]
    for y in range(750,800,5):
        xs=np.nonzero(a[y])[0]; runs=np.split(xs,np.where(np.diff(xs)>1)[0]+1)
        r=min(runs,key=lambda r:abs((r[0]+r[-1])/2-bc)); hs.append((r[0]+r[-1])/2)
    return float(np.median(hs))
for n in sys.argv[1:]:
    p=D+W[n]['image']; im=Image.open(p).convert('RGBA'); a=np.array(im)[...,3]>20
    dx=round(120-handle_cx(a))
    can=Image.new('RGBA',im.size); can.alpha_composite(im,(dx,0))
    C=np.array(can).astype(float)
    if dx>0: C[:,216:,3]*=np.linspace(1,0,24)[None,:]
    if dx<0: C[:,:24,3]*=np.linspace(0,1,24)[None,:]
    Image.fromarray(C.astype(np.uint8)).save(p)
    print(n,'dx',dx,'→ handle',round(handle_cx(np.array(Image.open(p))[...,3]>20),1))
