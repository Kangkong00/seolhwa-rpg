import sys; sys.path.insert(0,'/home/claude/seolhwa-rpg/tools/art')
import os; os.chdir('/tmp/claude-0/-home-claude/c356d753-662b-5c61-880b-58a929cb6baf/scratchpad/sw')
from swing3d import projc, draw_weapon, R, to640, BG
from PIL import Image, ImageDraw
import json, math
A=json.load(open('/home/claude/seolhwa-rpg/data/weapons.json'))['attach']['outfit1_hotot']
LAT={'front':0.15,'side':0,'back':0.15}
def comp(view,pose,th):
    body=to640(Image.open(R+f'{view}_{pose}.png').convert('RGBA')); hand=to640(Image.open(R+f'{view}_{pose}_hand.png').convert('RGBA'))
    x,y=A[pose][view]['grip']; sx,sy,behind=projc(view,th,LAT[view]); wl=draw_weapon(x,y,sx,sy)
    t=Image.new('RGBA',(640,720),BG)
    if behind: t.alpha_composite(wl); t.alpha_composite(body)
    else: t.alpha_composite(body); t.alpha_composite(wl)
    t.alpha_composite(hand); return t
def cur(t):  # 지금: theta = -40 + 165 t^2, 자세는 theta 문턱 5/80
    th=-40+165*t*t; pose='raise' if th<5 else ('swing' if th<80 else 'strike'); return pose,th
KEYS=[('raise',0.0,0.34,-40,-20,'in'),('swing',0.34,0.62,10,72,'lin'),('strike',0.62,1.0,95,125,'out')]
def new(t):
    for pose,a,b,t0,t1,e in KEYS:
        if t<=b or pose=='strike':
            u=min(1,max(0,(t-a)/(b-a))); u=u*u if e=='in' else (1-(1-u)**2 if e=='out' else u)
            return pose,t0+(t1-t0)*u
frames=[]
ts=[0]*3+[i/12 for i in range(13)]+[1]*5
for t in ts:
    row=Image.new('RGB',(320*4,400),(40,40,40))
    for i,(fn,lab) in enumerate([(cur,'지금'),(new,'고친 안')]):
        for j,v in enumerate(['side','front']):
            pose,th=fn(t); c=comp(v,pose,th).crop((40,0,600,720)).convert('RGB').resize((280,360))
            row.paste(c,((i*2+j)*320+20,30))
    d=ImageDraw.Draw(row); d.text((20,8),'NOW (ease 2, pose by angle)',fill=(255,255,0)); d.text((660,8),'FIX (pose-keyed angle)',fill=(0,255,255)); d.text((20,380),f't={t:.2f}',fill=(255,255,255))
    frames.append(row)
frames[0].save('swing_compare.gif',save_all=True,append_images=frames[1:],duration=[250]*3+[110]*13+[300]*5,loop=0)
strip=Image.new('RGB',(1280,400*4))
for k,t in enumerate([0.3,0.5,0.7,0.85]):
    i=min(range(len(ts)),key=lambda q:abs(ts[q]-t)); strip.paste(frames[i],(0,k*400))
strip.resize((960,1200)).save('swing_strip.png')
for t in [0.3,0.5,0.6,0.7,0.85,1]: print(t,'now',cur(t),'fix',new(t))
