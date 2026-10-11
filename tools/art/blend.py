from PIL import Image, ImageFilter, ImageEnhance, ImageChops
import numpy as np
M=Image.open('/home/claude/seolhwa-rpg/assets/maps/village.jpg').convert('RGBA')  # 2752 = 2x
ch=Image.open('/home/claude/seolhwa-rpg/assets/characters/outfit1_hotot/front.png')
rat=Image.open('/home/claude/seolhwa-rpg/assets/monsters/rat/side.png')
def scale(im,h_px,canvas_h,stand_h):  # stand_h: 그림 속 키
    s=h_px/stand_h; return im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
H=124  # 62 x 2 (아이폰 2배 화면)
c0=scale(ch,H,720,640)
def outline(im,px=2,color=(70,48,30)):
    a=np.array(im)[...,3]
    m=Image.fromarray(a).filter(ImageFilter.MaxFilter(px*2+1))
    o=Image.new('RGBA',im.size,color+(0,)); o.putalpha(Image.fromarray((np.array(m)>40).astype('uint8')*235))
    o.alpha_composite(im); return o
def grade(im,sat=0.85,con=0.92,warm=(1.03,1.0,0.94)):
    rgb=im.convert('RGB'); rgb=ImageEnhance.Color(rgb).enhance(sat); rgb=ImageEnhance.Contrast(rgb).enhance(con)
    a=np.array(rgb).astype(float)*np.array(warm); a=np.clip(a,0,255).astype('uint8')
    o=Image.fromarray(a).convert('RGBA'); o.putalpha(im.getchannel('A')); return o
def soften(im): # 그림 결 맞추기: 아주 살짝 흐림 후 선명도 낮춤
    return im.filter(ImageFilter.GaussianBlur(0.5))
variants=[('원본',c0),('외곽선',outline(c0)),('외곽선+색맞춤',grade(outline(c0))),('외곽선+색맞춤+결',soften(grade(outline(c0))))]
crop=(1300,880,1300+300,880+260)  # 우물 광장 근처(2x 좌표)
tiles=[]
for name,c in variants:
    bg=M.crop(crop).copy()
    sh=Image.new('RGBA',(60,20),(0,0,0,0)); 
    from PIL import ImageDraw
    d=ImageDraw.Draw(sh); d.ellipse([0,0,59,19],fill=(0,0,0,90)); sh=sh.filter(ImageFilter.GaussianBlur(3))
    x,y=150,200
    bg.alpha_composite(sh,(x-30,y-10)); bg.alpha_composite(c,(x-c.width//2,y-round(c.height*700/720)))
    tiles.append(bg)
out=Image.new('RGB',(300*4,260))
for i,t in enumerate(tiles): out.paste(t.convert('RGB'),(i*300,0))
out.resize((1200*2//2*1,260)).save('blend_test.png')
out.resize((2400,520),Image.NEAREST).crop((0,0,2400,520)).save('blend_test_zoom.png')
