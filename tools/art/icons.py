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
sheet=Image.open(G+'assets/source/items_toshi_jipsin_sheet.jpg')
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
# preview on slot frames, at game-ish sizes
P=Image.new('RGB',(6*150+20,330*2),(40,32,26)); D=ImageDraw.Draw(P)
for i,(k,c) in enumerate(icons.items()):
    x=20+(i%6)*150; yo=(i//6)*330
    D.rectangle((x,20+yo,x+128,148+yo),fill=(70,56,44),outline=(150,120,80),width=2)
    P.paste(c.resize((120,120),Image.LANCZOS),(x+4,24+yo),c.resize((120,120),Image.LANCZOS))
    D.rectangle((x+40,180+yo,x+88,228+yo),fill=(70,56,44),outline=(150,120,80),width=1)
    s=c.resize((44,44),Image.LANCZOS); P.paste(s,(x+42,182+yo),s)
    D.text((x,250+yo),k,fill=(240,230,210))
P.save(G+'docs/item_icons.png')
print(list(icons))
