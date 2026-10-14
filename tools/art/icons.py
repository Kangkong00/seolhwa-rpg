# 장비 아이콘 만들기: 아이템 시트(토시·짚신)를 오리고, 두건은 두건 뒷면 그림(매듭이 보여 알아보기 쉬움), 목검은 무기 그림을 45도 눕혀서
# 256x256 투명 캔버스 가운데(여백 18px)에 맞춤 -> assets/items/icons/<id>.png, 시안 docs/item_icons.png
import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
from cut2 import cutout
from PIL import Image, ImageDraw
import numpy as np
G='/home/claude/seolhwa-rpg/'
OUT=G+'assets/items/icons/'; import os; os.makedirs(OUT,exist_ok=True)
N=256; PAD=18
def fit(im,name):
    im=im.crop(im.getbbox()); s=(N-2*PAD)/max(im.size)
    im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    c=Image.new('RGBA',(N,N),(0,0,0,0)); c.alpha_composite(im,((N-im.width)//2,(N-im.height)//2)); c.save(OUT+name+'.png',optimize=True); return c
sheet=Image.open(G+'assets/source/v3/items_toshi_jipsin_sheet.webp')
W=sheet.width
icons={}
icons['toshi_mumyeong']=fit(cutout(sheet,(0,0,W//2,sheet.height)),'toshi_mumyeong')
icons['shoes_jipsin']=fit(cutout(sheet,(W//2,0,W,sheet.height)),'shoes_jipsin')
hood=Image.open(G+'assets/equipment/head/hood_mumyeong/back.png')
icons['hood_mumyeong']=fit(hood,'hood_mumyeong')
for w in ['wood_pine','wood_oak','wood_bakdal']:
    im=Image.open(G+f'assets/weapons/{w}.png').convert('RGBA')
    icons[w]=fit(im.rotate(-45,resample=Image.BICUBIC,expand=True),w)
# 옷: 서 있기 정면에서 목 아래~발목(얼굴 빼고 옷만)
import json
for o in json.load(open(G+'data/outfits.json'))['outfits']:
    im=Image.open(G+o['folder']+'/front.png').convert('RGBA')
    a=np.array(im)[...,3]; top=np.where(a.max(1)>0)[0][0]
    icons[o['id']]=fit(im.crop((0,top+256,400,690)),o['id'])
# 흰 물건(쌀·주먹밥·사발)은 안쪽 흰색을 지우면 구멍이 나므로, 테두리에서 이어진 배경만 지움
from scipy import ndimage
from PIL import ImageFilter
def cutout_border(img,box):
    im=img.convert('RGB').crop(box); a=np.array(im).astype(int)
    mn=a.min(2); sp=a.max(2)-mn
    white=(mn>236)&(sp<14)
    lab,n=ndimage.label(white)
    edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(edge)); bg|=ndimage.binary_dilation(bg,iterations=1)&(mn>222)&(sp<22)
    fg=~bg; l2,n2=ndimage.label(fg)
    if n2>1:
        sz=ndimage.sum(fg,l2,range(1,n2+1)); fg=np.isin(l2,1+np.where(sz>=0.02*sz.max())[0])
    al=Image.fromarray((fg*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6))
    out=im.convert('RGBA'); out.putalpha(al); return out.crop(out.getbbox())
# 전리품·엽전·먹을거리 8개 (Flow 4x2 시트)
ls=Image.open(G+'assets/source/v3/items_loot_sheet.webp')
cw,ch=ls.width//4,ls.height//2
for i,n in enumerate(['loot_rat_meat','loot_rice','loot_rat_hide','loot_rat_whisker','loot_rat_tooth','coins','food_riceball','med_tangyak']):
    cx,cy=(i%4)*cw,(i//4)*ch
    f=cutout_border if n in ('loot_rice','food_riceball','med_tangyak') else cutout
    bx=(cx,cy+(60 if n=='med_tangyak' else 0),cx+cw,cy+ch)  # 탕약: 위쪽 김은 아이콘에서 뺌
    c=f(ls,bx)
    if n=='med_tangyak':  # 사발 테두리 위에 붙은 김 조각 지우기(밝고 색이 옅은 픽셀, 위쪽 띠)
        a=np.array(c); h=a.shape[0]; top=a[:int(h*0.14)]
        rgb=top[...,:3].astype(int); pale=(rgb.min(2)>200)&((rgb.max(2)-rgb.min(2))<25)
        top[pale,3]=0; a[:int(h*0.14)]=top; c=Image.fromarray(a); c=c.crop(c.getbbox())
    icons[n]=fit(c,n)
# 새 아이콘 8개(v3, 4x2 시트): 족제비 전리품 3·쥐왕 꿰미 / 귀환 부적·무예 3
# Flow가 족제비 고기는 쥐고기, 쥐왕 꿰미는 엽전과 똑같이 그려서 임시로 색을 바꿔 구별(다시 그리면 교체)
import colorsys
def recolor(c,fn):
    a=np.array(c).astype(float)/255; out=a.copy()
    for y,x in zip(*np.nonzero(a[...,3]>0)):
        out[y,x,:3]=fn(*a[y,x,:3])
    return Image.fromarray((out*255).clip(0,255).astype(np.uint8))
def meat_dark(r,g,b):   # 붉은 살코기만 더 짙은 갈색빛으로(잎·끈은 그대로)
    h,l,s_=colorsys.rgb_to_hls(r,g,b)
    if (h<0.04 or h>0.9) and s_>0.25: return colorsys.hls_to_rgb(0.02,l*0.72,s_*0.8)
    return (r,g,b)
def gold(r,g,b):        # 엽전을 금빛으로
    h,l,s_=colorsys.rgb_to_hls(r,g,b)
    if s_>0.12 and not (0.05<h<0.14 and l>0.6): return colorsys.hls_to_rgb(0.12,min(1,l*1.12),min(1,s_*1.3+0.15))
    return (r,g,b)
i2=Image.open(G+'assets/source/v3/items_icons2_sheet.webp')
cw,ch=i2.width//4,i2.height//2
for i,n in enumerate(['loot_weasel_meat','loot_weasel_hide','loot_hwangmo','loot_ratking_coins','item_return_charm','skill_power_slash','skill_breath','skill_whirl']):
    cx,cy=(i%4)*cw,(i//4)*ch
    c=cutout(i2,(cx,cy,cx+cw,cy+ch))
    if n=='loot_weasel_meat': c=recolor(c,meat_dark)
    if n=='loot_ratking_coins': c=recolor(c,gold)
    icons[n]=fit(c,n)
# preview on slot frames, at game-ish sizes
P=Image.new("RGB",(6*150+20,330*((len(icons)+5)//6)),(40,32,26)); D=ImageDraw.Draw(P)
for i,(k,c) in enumerate(icons.items()):
    x=20+(i%6)*150; yo=(i//6)*330
    D.rectangle((x,20+yo,x+128,148+yo),fill=(70,56,44),outline=(150,120,80),width=2)
    P.paste(c.resize((120,120),Image.LANCZOS),(x+4,24+yo),c.resize((120,120),Image.LANCZOS))
    D.rectangle((x+40,180+yo,x+88,228+yo),fill=(70,56,44),outline=(150,120,80),width=1)
    s=c.resize((44,44),Image.LANCZOS); P.paste(s,(x+42,182+yo),s)
    D.text((x,250+yo),k,fill=(240,230,210))
P.save(G+'docs/item_icons.png')
print(list(icons))
