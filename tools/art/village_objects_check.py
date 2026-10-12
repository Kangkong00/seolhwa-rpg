# 앞뒤 가림 확인 그림: python3 village_objects_check.py "[[x,y],...]" out.jpg — 조각 아틀라스로 캐릭터를 합성해 봄
import numpy as np, json, sys
from PIL import Image, ImageDraw
G='/home/claude/seolhwa-rpg/'; S='/tmp/claude-0/-home-claude-seolhwa-rpg/1798b720-9bbd-5e1d-af87-0516171baaa5/scratchpad/'
J=json.load(open(G+'assets/maps/village_objects.json')); A=json.load(open(G+'assets/maps/village_objects_atlas.json'))
at=Image.open(G+'assets/maps/village_objects.webp').convert('RGBA')
P=[]
for o in J['objects']:
    f=A['frames'][o['frame']]['frame']; P.append((o,at.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).resize((o['w'],o['h']),Image.LANCZOS)))
bg=Image.open(G+'assets/maps/village.jpg').convert('RGBA').resize((1376,768),Image.LANCZOS)
pts=json.loads(sys.argv[1]); face=sys.argv[3] if len(sys.argv)>3 else 'back'
spr=Image.open(G+f'assets/characters/outfit1_hotot/{face}.png').convert('RGBA'); s=62/640; spr=spr.resize((round(400*s),round(720*s)),Image.LANCZOS); fy=round(700*s)
tiles=[]
for x,y in pts:
    im=bg.copy(); ImageDraw.Draw(im,'RGBA').ellipse((x-15,y-5,x+15,y+5),fill=(0,0,0,90)); im.alpha_composite(spr,(x-spr.width//2,y-fy))
    for o,p in sorted(P,key=lambda t:t[0]['baseY']):
        if o['baseY']>y: im.alpha_composite(p,(o['x'],o['y']))
    t=im.convert('RGB').crop((x-60,y-90,x+60,y+20)).resize((240,220),Image.LANCZOS); ImageDraw.Draw(t).text((3,3),f'{x},{y}',fill=(255,0,0)); tiles.append(t)
W=Image.new('RGB',(240*6,220*((len(tiles)+5)//6)),'white')
for i,t in enumerate(tiles): W.paste(t,((i%6)*240,(i//6)*220))
W.save(S+sys.argv[2])
