from swing3d import *
import json
HOLD={'front_hold':((200,420),15,-0.12),'side_hold':((200,414),20,0),'back_hold':((436,414),10,-0.12),
'front_hold_step':((224,424),15,-0.12),'side_hold_step':((210,420),20,0),'back_hold_step':((450,386),10,-0.12)}
def comp(n,x,y,v,th,lat):
    body=Image.open(R+n+'.png'); hand=Image.open(R+n+'_hand.png')
    sx,sy,behind=projc(v,th,lat); wl=draw_weapon(x,y,sx,sy)
    t=Image.new('RGBA',(640,720),BG)
    if behind: t.alpha_composite(wl); t.alpha_composite(body)
    else: t.alpha_composite(body); t.alpha_composite(wl)
    t.alpha_composite(hand); return t
cells=[comp(n,x,y,n.split('_')[0],th,lat) for n,((x,y),th,lat) in HOLD.items()]
s=Image.new('RGB',(520*3,720*2))
for i,t in enumerate(cells): s.paste(t.crop((60,0,580,720)).convert('RGB'),((i%3)*520,(i//3)*720))
s.resize((780,720)).save('hold_mock.png')
# close-ups of hands
cu=Image.new('RGB',(6*200,200))
for i,(n,((x,y),th,lat)) in enumerate(HOLD.items()):
    cu.paste(cells[i].crop((x-100,y-100,x+100,y+100)).convert('RGB'),(i*200,0))
cu.save('hold_closeup.png')
# swing gif with hands
F=json.load(open('fists.json'))
SWP={'front':('front_raise','front_strike'),'side':('side_raise','side_strike'),'back':('back_raise','back_strike')}
frames=[]
for u in [0,0,0.15,0.3,0.45,0.58,0.65,0.75,0.88,1,1,1]:
    row=Image.new('RGBA',(640*3,720),BG)
    for i,v in enumerate(['front','side','back']):
        p=SW[v]; th=p['t0']+(p['t1']-p['t0'])*u
        r=F[SWP[v][0]]; st=F[SWP[v][1]]
        x,y=(r if u<0.6 else st)
        n=SWP[v][0] if u<0.6 else SWP[v][1]
        row.alpha_composite(comp(n,x,y,v,th,p['lat']),(i*640,0))
    frames.append(row.convert('RGB').resize((960,360)))
frames[0].save('swing_grip.gif',save_all=True,append_images=frames[1:],duration=[300,300]+[90]*7+[500,500,500],loop=0)
