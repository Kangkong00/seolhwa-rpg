# 옷 6종 무기 자세 시안(인자: 무기 id, 머리 장비 폴더, 출력 이름): 두건 + 박달 목검(또는 인자로 무기 id), 들고 서 있기 3방향 + 치켜들기·휘두르기·내려치기(옆면) + 정면 휘두르기 + 뒷면 내려치기
# + 휘두르기 GIF(3방향). docs/outfit_weapons_mock.png, docs/outfit_weapons_swing.gif
import json, math, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
G='/home/claude/seolhwa-rpg/'
WID=sys.argv[1] if len(sys.argv)>1 else 'wood_bakdal'
HAT=sys.argv[2] if len(sys.argv)>2 else 'hood_mumyeong'
OUTP=sys.argv[3] if len(sys.argv)>3 else 'outfit_weapons'
WP=json.load(open(G+'data/weapons.json')); REF=WP['attach']['outfit1_hotot']
AN=json.load(open(G+'assets/equipment/head/head_anchor.json'))
OUT=['outfit1_hotot','outfit2_mumyeong','outfit3_dopo','outfit4_cheollik','outfit5_dujeonggap','outfit6_sinseon']
NAME=['홑옷','무명옷','도포','철릭','두정갑','신선복']
K=0.5; BG=(150,170,150,255)
Wp=Image.open(G+f'assets/weapons/{WID}.png').convert('RGBA')
def grips(o):
    if o=='outfit1_hotot': return {f'{d}_{k}':v['grip'] for k,dd in REF.items() for d,v in dd.items()}
    return json.load(open(G+f'assets/characters/{o}/weapon_grips.json'))
GR={o:grips(o) for o in OUT}
def proj(view,theta,lat):
    Y=math.cos(math.radians(theta)); F=math.sin(math.radians(theta))
    if view=='front': sx,sy,b=lat,-Y+K*F,F<0
    elif view=='back': sx,sy,b=-lat,-Y-K*F,F>0
    else: sx,sy,b=-F,-Y,F<0
    L=math.hypot(sx,sy)
    if L>1: sx,sy=sx/L,sy/L
    return sx,sy,b
def weapon(x,y,sx,sy):
    L=math.hypot(sx,sy); ang=math.degrees(math.atan2(sx,-sy))
    w=Wp.resize((240,max(2,round(960*L)))); gy=800*L
    big=Image.new('RGBA',(2400,2400)); big.alpha_composite(w,(1080,round(1200-gy)))
    big=big.rotate(-ang,center=(1200,1200),resample=Image.BICUBIC)
    lay=Image.new('RGBA',(640,720)); lay.alpha_composite(big.crop((1200-x,1200-y,1200-x+640,1200-y+720))); return lay
def to640(im):
    if im.width==640: return im
    c=Image.new('RGBA',(640,720)); c.alpha_composite(im,(120,0)); return c
def hooded(o,n):
    b=Image.open(G+f'assets/characters/{o}/{n}.png').convert('RGBA'); a=AN[f'{o}/{n}']
    tk=np.array(Image.open(G+f'assets/equipment/head/{HAT}/topknot/{o}/{n}.png').convert('RGBA'))[...,3]
    ba=np.array(b); ba[tk>0,3]=0; b=Image.fromarray(ba)
    hd=Image.open(G+'assets/equipment/head/'+HAT+'/'+n.split('_')[0]+'.png').convert('RGBA')
    s=a['scale']; big=Image.new('RGBA',(1400,1400)); fx,fy=a['from']; big.alpha_composite(hd,(int(700-fx),int(700-fy)))
    big=big.resize((round(1400*s),)*2).rotate(-a['rotDeg'],center=(700*s,700*s))
    tx,ty=a['to']; L=Image.new('RGBA',b.size); L.alpha_composite(big,(int(tx-700*s),int(ty-700*s)))
    b.alpha_composite(L); return to640(b)
def frame(o,pose,view,theta,lat):
    n=f'{view}_{pose}'; body=hooded(o,n); hand=to640(Image.open(G+f'assets/characters/{o}/{n}_hand.png').convert('RGBA'))
    x,y=GR[o][n]; sx,sy,behind=proj(view,theta,lat); wl=weapon(x,y,sx,sy)
    t=Image.new('RGBA',(640,720),BG)
    if behind: t.alpha_composite(wl); t.alpha_composite(body)
    else: t.alpha_composite(body); t.alpha_composite(wl)
    t.alpha_composite(hand); return t
SW=WP['swing']; LATFB=SW['latFrontBack']
cols=[('hold','front',REF['hold']['front']['theta'],REF['hold']['front']['lat']),('hold','side',REF['hold']['side']['theta'],0),
      ('hold','back',REF['hold']['back']['theta'],REF['hold']['back']['lat']),('raise','side',-40,0),('swing','side',40,0),
      ('strike','side',125,0),('swing','front',40,LATFB),('strike','back',125,LATFB)]
CW,CH=330,520
sh=Image.new('RGB',(CW*len(cols),CH*len(OUT)),'white'); D=ImageDraw.Draw(sh)
try: f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc',28)
except: f=None
for r,o in enumerate(OUT):
    for c,(p,v,th,lat) in enumerate(cols):
        t=frame(o,p,v,th,lat).crop((155,0,485,520)); sh.paste(t.convert('RGB'),(c*CW,r*CH))
    D.text((8,r*CH+6),NAME[r],fill=(0,0,0),font=f)
sh.resize((sh.width//2,sh.height//2),Image.LANCZOS).save(G+f'docs/{OUTP}_mock.png')
# 휘두르기 GIF (옷 6종 × 3방향, 홑옷 시안과 같은 단계 전환)
def stage(th): return 'raise' if th<SW['poseSwingTheta'] else ('swing' if th<SW['poseStrikeTheta'] else 'strike')
frames=[]
for u in [0,0,0.12,0.25,0.35,0.45,0.55,0.65,0.75,0.88,1,1,1]:
    th=SW['thetaFrom']+(SW['thetaTo']-SW['thetaFrom'])*(u**SW['ease'] if False else u)
    row=Image.new('RGB',(3*200*len(OUT)//2,2*240),'white')
    for i,o in enumerate(OUT):
        for j,v in enumerate(['front','side','back']):
            t=frame(o,stage(th),v,th,0 if v=='side' else LATFB).crop((120,0,520,480)).resize((200,240))
            row.paste(t.convert('RGB'),(((i%3)*3+j)*200,(i//3)*240))
    frames.append(row)
frames[0].save(G+f'docs/{OUTP}_swing.gif',save_all=True,append_images=frames[1:],duration=[300,300]+[70]*8+[500,500,500],loop=0)
print('ok')
