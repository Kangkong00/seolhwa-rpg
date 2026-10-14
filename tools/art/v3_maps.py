# 새 그림체(v3) 던전 맵: 2752×1536으로 맞추고 Flow 반짝이(워터마크, 오른쪽 아래) 지움 → assets/maps/<id>.jpg
# 반짝이 = 오른쪽 아래 구역에서 주변(큰 중간값 흐림)보다 밝고 색이 옅은(회백색) 픽셀 → cv2.inpaint
import numpy as np, cv2, sys
from scipy import ndimage
from PIL import Image
G='/home/claude/seolhwa-rpg/'
SPARK=[((2639,1423),34),((2557,1341),62)]   # Flow 반짝이 자리(2752 기준): 작은 것(모든 그림), 큰 것(일부 그림) — (가운데, 반지름)
def dewm(rgb):
    """반짝이 = 흰색이 반투명하게 덮인 별 → 정해진 자리의 원 안에서 가장 낮은 색 채널(min RGB)이 주변보다 올라간 픽셀만 지움"""
    a=rgb.copy(); y0,x0=1200,2340; reg=np.ascontiguousarray(a[y0:,x0:])
    mn=reg.min(2).astype(int); bg=cv2.medianBlur(reg.min(2),151).astype(int)
    yy,xx=np.mgrid[:reg.shape[0],:reg.shape[1]]; m=np.zeros(mn.shape,bool)
    for (cx,cy),r in SPARK:
        win=((xx-(cx-x0))**2+(yy-(cy-y0))**2)<r**2
        hot=win&((mn-bg)>12)
        if hot.sum()<0.18*win.sum(): continue        # 이 그림엔 이 반짝이가 없음
        m|=ndimage.binary_fill_holes(ndimage.binary_closing(hot,iterations=2))
    m=(ndimage.binary_dilation(m,iterations=4)).astype(np.uint8)
    a[y0:,x0:]=cv2.inpaint(reg,m,12,cv2.INPAINT_TELEA); return a,int(m.sum())
if __name__=='__main__':
    im=np.array(Image.open(G+'assets/source/v3/village.jpg').convert('RGB').resize((2752,1536),Image.LANCZOS))
    out,n=dewm(im); Image.fromarray(out).save(G+'assets/maps/village.jpg',quality=90); print('village',n)
    for src,dst in [('dungeon_rat_1.jpg','dungeon_rat_1.jpg'),('dungeon_rat_2.jpg','dungeon_rat_2.jpg'),('dungeon_rat_3.jpg','dungeon_rat_3.jpg'),('dungeon_weasel_1.jpg','dungeon_weasel_1.jpg')]:
        im=np.array(Image.open(G+'assets/source/v3/'+src).convert('RGB').resize((2752,1536),Image.LANCZOS))
        out,n=dewm(im); Image.fromarray(out).save(G+'assets/maps/'+dst,quality=90); print(dst,n)
