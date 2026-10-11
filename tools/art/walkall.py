from PIL import Image, ImageOps, ImageDraw, ImageFont
import numpy as np
R='/home/claude/seolhwa-rpg/assets/characters/'
font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',16,index=1)
outs=[('outfit1_hotot',530,'홑옷'),('outfit2_mumyeong',590,'무명옷'),('outfit3_dopo',592,'도포'),('outfit4_cheollik',612,'철릭'),('outfit5_dujeonggap',600,'두정갑'),('outfit6_sinseon',600,'신선복')]
def L(d,n): return Image.open(R+d+'/'+n+'.png')
def legmirror(im,cut):
    a=np.array(im)[:,:,3]>128; xs=np.where(a[cut:].any(0))[0]; cx=(xs.min()+xs.max())/2; W,H=im.size
    low=ImageOps.mirror(im.crop((0,cut,W,H))); out=Image.new('RGBA',im.size,(0,0,0,0)); out.alpha_composite(low,(int(round(2*cx-W)),cut))
    up=np.array(im).copy(); up[cut:,:,3]=0; out.alpha_composite(Image.fromarray(up)); return out
cw,ch=140,250; frames=[Image.new('RGB',(cw*4+70,ch*6),(214,190,140)) for _ in range(4)]
for i,(d,cut,name) in enumerate(outs):
    seqs=[[L(d,'front_step'),L(d,'front'),legmirror(L(d,'front_step'),cut),L(d,'front')],
          [L(d,'back_step'),L(d,'back'),legmirror(L(d,'back_step'),cut),L(d,'back')],
          [L(d,'side_step'),L(d,'side')]*2]
    seqs.append([ImageOps.mirror(x) for x in seqs[2]])
    for t in range(4):
        dr=ImageDraw.Draw(frames[t]); dr.text((6,i*ch+ch//2),name,font=font,fill=(40,30,20))
        for j,s in enumerate(seqs):
            im=s[t].resize((cw*400//400//1,0) if False else (int(400*0.33),int(720*0.33)),Image.LANCZOS)
            bob=-2 if t%2==1 else 0
            frames[t].paste(im,(70+j*cw,i*ch+5+bob),im)
frames[0].save('walk_all.gif',save_all=True,append_images=frames[1:],duration=180,loop=0)
st=Image.new('RGB',(frames[0].width*2,frames[0].height)); st.paste(frames[0],(0,0)); st.paste(frames[2],(frames[0].width,0)); st.save('walk_all_check.png')
