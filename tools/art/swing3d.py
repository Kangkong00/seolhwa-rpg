from PIL import Image, ImageDraw
import math
R='/home/claude/seolhwa-rpg/assets/characters/outfit1_hotot/'
Wp=Image.open('/home/claude/seolhwa-rpg/assets/weapons/wood_pine.png')
K=0.5  # depth factor
BG=(150,170,150,255)
def to640(im):
    if im.width==640: return im
    c=Image.new('RGBA',(640,720)); c.alpha_composite(im,(120,0)); return c
def draw_weapon(x,y,sx,sy):
    L=math.hypot(sx,sy); ang=math.degrees(math.atan2(sx,-sy))
    w=Wp.resize((240,max(2,round(960*L)))); gy=800*L
    big=Image.new('RGBA',(2400,2400)); big.alpha_composite(w,(1200-120,round(1200-gy)))
    big=big.rotate(-ang,center=(1200,1200),resample=Image.BICUBIC)
    lay=Image.new('RGBA',(640,720)); lay.alpha_composite(big.crop((1200-x,1200-y,1200-x+640,1200-y+720))); return lay
def proj(view,theta,lat):
    Y=math.cos(math.radians(theta)); F=math.sin(math.radians(theta))
    if view=='front': return lat, -Y+K*F, F<0
    if view=='back': return -lat, -Y-K*F, F>0
    return -F, -Y, F<0   # side, facing left
def projc(view,theta,lat):
    sx,sy,b=proj(view,theta,lat); L=math.hypot(sx,sy)
    if L>1: sx,sy=sx/L,sy/L
    return sx,sy,b
SW={'front':dict(t0=-40,t1=125,lat=0.15,r=(150,160),s=(360,464)),
    'back':dict(t0=-40,t1=125,lat=0.15,r=(480,160),s=(430,390)),
    'side':dict(t0=-40,t1=125,lat=0.0,r=(214,136),s=(210,480))}
def frame(view,u,trail):
    p=SW[view]; th=p['t0']+(p['t1']-p['t0'])*u
    hx=p['r'][0]+(p['s'][0]-p['r'][0])*u; hy=p['r'][1]+(p['s'][1]-p['r'][1])*u
    body=Image.open(R+f"{view}_{'raise' if u<0.4 else 'strike'}.png")
    sx,sy,behind=projc(view,th,p['lat'])
    tip=(hx+sx*560, hy+sy*560); trail.append(tip)
    wl=draw_weapon(round(hx),round(hy),sx,sy)
    t=Image.new('RGBA',(640,720),BG)
    if behind: t.alpha_composite(wl); t.alpha_composite(body)
    else: t.alpha_composite(body); t.alpha_composite(wl)
    d=ImageDraw.Draw(t)
    if len(trail)>1: d.line(trail,fill=(30,30,30,255),width=10)
    return t
frames=[]
us=[0,0,0.1,0.25,0.4,0.55,0.7,0.85,1,1,1,1]
trails={v:[] for v in SW}
for u in us:
    row=Image.new('RGBA',(640*3,720),BG)
    for i,v in enumerate(['front','side','back']): row.alpha_composite(frame(v,u,trails[v]),(i*640,0))
    frames.append(row.convert('RGB').resize((960,360)))
frames[0].save('swing3d.gif',save_all=True,append_images=frames[1:],duration=[300,300]+[90]*7+[400,400,400],loop=0)
# strip of key frames
strip=Image.new('RGB',(960,360*4))
for i,k in enumerate([0,4,6,8]): strip.paste(frames[k],(0,i*360))
strip.resize((720,1080)).save('swing3d_strip.png')
