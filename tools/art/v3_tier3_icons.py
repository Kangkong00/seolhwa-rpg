# 구간 3(뱀굴) 묶음 아이콘 (Flow 69~80, 2026-10-18) → assets/items/icons/<id>.png (256×256, 여백 18, icons.py fit과 같음)
# 시트의 물건 덩어리를 찾아 줄(위→아래)·칸(왼→오) 순서로 id를 붙임. 흰 물건(허물 등)은 테두리에서 이어진 배경만 지움.
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage
G='/home/claude/seolhwa-rpg/'; V=G+'assets/source/v3/'; OUT=G+'assets/items/icons/'
N=256; PAD=18
def fit(im,name):
    im=im.crop(im.getbbox()); s=(N-2*PAD)/max(im.size)
    im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    c=Image.new('RGBA',(N,N)); c.alpha_composite(im,((N-im.width)//2,(N-im.height)//2)); c.save(OUT+name+'.png',optimize=True); return c
def items(path,ids,rows,grow=14):
    im=Image.open(V+path).convert('RGB'); a=np.array(im).astype(int)
    mn=a.min(2); sp=a.max(2)-mn
    white=(mn>234)&(sp<16)
    lab,n=ndimage.label(white)
    edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(edge)); bg|=ndimage.binary_dilation(bg,iterations=1)&(mn>220)&(sp<24)
    # 둘러싸인 순백 구멍(팔찌 안·발톱 끈 고리 안)도 배경
    strict=(mn>243)&(sp<10); sl,sn=ndimage.label(strict&~bg)
    if sn:
        szs=ndimage.sum(np.ones_like(sl),sl,range(1,sn+1))
        for k,v in enumerate(szs,1):
            if v>=150: bg|=(sl==k)
        bg|=ndimage.binary_dilation(bg,iterations=1)&(mn>226)&(sp<20)
    fg=~bg
    # 워터마크(오른쪽 아래 반짝이) 지우기
    fg[int(a.shape[0]*0.86):,int(a.shape[1]*0.95):]=False
    # 물건 하나가 여러 조각(끈·불꽃 등)일 수 있어 크게 이어 붙여 덩어리를 찾음
    big=ndimage.binary_dilation(fg,iterations=grow)
    l2,n2=ndimage.label(big); sz=ndimage.sum(fg,l2,range(1,n2+1))
    keep=[i+1 for i,v in enumerate(sz) if v>0.08*sz.max()]
    boxes=[]
    for i in keep:
        ys,xs=np.nonzero((l2==i)&fg); boxes.append((ys.mean(),xs.mean(),ys.min(),ys.max(),xs.min(),xs.max(),i))
    assert len(boxes)==len(ids),(path,len(boxes),len(ids))
    H=a.shape[0]; boxes.sort(key=lambda b:(int(b[0]//(H/rows)),b[1]))
    al=Image.fromarray((fg*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6))
    rgba=im.convert('RGBA'); rgba.putalpha(al)
    out={}
    for (cy,cx,y0,y1,x0,x1,i),name in zip(boxes,ids):
        m=(l2==i)
        c=np.array(rgba); c[~m,3]=0
        piece=Image.fromarray(c).crop((x0,y0,x1+1,y1+1)); out[name]=fit(piece,name)
    return out
if __name__=="__main__":
    R={}
    R.update(items('skill_icons1_sheet.webp',['skill_triple_cut','skill_dash_cut','skill_roar','skill_earth_split','skill_sword_wind'],1,3))
    R.update(items('skill_icons2_sheet.jpg',['skill_counter','skill_whirlwind','skill_thunder_cut','skill_tiger_flash','skill_seven_star_dance'],1,3))
    R.update(items('items_boss_mats_sheet.webp',['loot_snake_skin','loot_snake_fang','loot_serpent_scale','loot_dogking_fang','loot_raccoon_tail',
        'loot_foxfire_bead','loot_boar_tusk','loot_bear_claw','loot_tiger_fang','loot_tiger_hide'],2))
    R.update(items('items_toshi_sheet.jpg',['toshi_leather','toshi_ironring','toshi_deer','toshi_silk','toshi_scale','toshi_dragon'],2))
    R.update(items('items_shoes_sheet.jpg',['shoes_mituri','shoes_leather','shoes_mokhwa','shoes_silk','shoes_taesa','shoes_unhye'],2))
    R.update(items('items_bracelet_sheet.jpg',['bracelet_bead','bracelet_jade','bracelet_silver','bracelet_gold','bracelet_chilbo'],1,2))
    # 미리보기
    names=list(R); cols=10; P=Image.new('RGBA',(cols*130,((len(names)+cols-1)//cols)*130),(70,70,70,255))
    for k,nm in enumerate(names): P.alpha_composite(R[nm].resize((128,128)),((k%cols)*130,(k//cols)*130))
    P.convert('RGB').save(G+'docs/tier3_icons.png'); print(len(names),'icons')
