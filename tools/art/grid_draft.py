# 던전 격자 초안: 밝은 흙바닥 색 → 갈 수 있는 칸. 사용: python3 grid_draft.py <맵 id> [밝기 기준]
# 8px 칸에서 바닥 픽셀이 60% 넘으면 '.', 가장 큰 덩어리만 남기고, 벽 가장자리 1칸은 막음(캐릭터가 벽에 파묻히지 않게).
# 결과: docs/map_drafts/<id>_blocked.txt + 미리보기 docs/map_drafts/<id>_grid.jpg  (Claude Code가 data/maps/<id>.json 의 blocked 로 씀)
import numpy as np, cv2, sys, os, json
from PIL import Image
from scipy import ndimage
G='/home/claude/seolhwa-rpg/'
def draft(mid,th=None):
    im=np.array(Image.open(G+f'assets/maps/{mid}.jpg').convert('RGB').resize((1376,768),Image.LANCZOS))
    hsv=cv2.cvtColor(cv2.GaussianBlur(im,(0,0),2),cv2.COLOR_RGB2HSV).astype(int)
    v=hsv[...,2]; s=hsv[...,1]
    if th is None: th=int(np.percentile(v,58))
    floor=(v>=th)&(s<170)
    cs=8; H,W=768//cs,1376//cs
    cell=floor.reshape(H,cs,W,cs).mean((1,3))>0.6
    cell=ndimage.binary_opening(cell,iterations=1)
    lab,n=ndimage.label(cell); sz=ndimage.sum(cell,lab,range(1,n+1)); cell=lab==(1+np.argmax(sz))
    cell=ndimage.binary_fill_holes(cell)
    cell=ndimage.binary_erosion(cell,iterations=1)
    lab,n=ndimage.label(cell); sz=ndimage.sum(cell,lab,range(1,n+1)); cell=lab==(1+np.argmax(sz))
    return cell,th,im
if __name__=='__main__':
    mid=sys.argv[1]; th=int(sys.argv[2]) if len(sys.argv)>2 else None
    cell,th,im=draft(mid,th)
    os.makedirs(G+'docs/map_drafts',exist_ok=True)
    open(G+f'docs/map_drafts/{mid}_blocked.txt','w').write('\n'.join(''.join('.' if c else '#' for c in row) for row in cell)+'\n')
    vis=im.copy(); big=np.kron(cell,np.ones((8,8),bool))
    vis[~big]=(vis[~big]*0.45+np.array([160,0,0])*0.55).astype(np.uint8)
    Image.fromarray(vis).save(G+f'docs/map_drafts/{mid}_grid.jpg',quality=80)
    print(mid,'기준',th,'갈 수 있는 칸',int(cell.sum()))
