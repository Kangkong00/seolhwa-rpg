from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage
def cutout(img, box):
    im=img.convert('RGB').crop(box); a=np.array(im).astype(int)
    mn=a.min(axis=2); spread=a.max(axis=2)-mn
    white=(mn>225)&(spread<25)
    lab,n=ndimage.label(white)
    edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(edge))
    # enclosed pure-white pockets (between arm and body): very bright & neutral, not cloth
    strict=(mn>244)&(spread<9)
    sl,sn=ndimage.label(strict&~bg)
    if sn:
        sz=ndimage.sum(np.ones_like(sl),sl,range(1,sn+1))
        for i,s in enumerate(sz,1):
            if s>=25: bg|=(sl==i)
        # grow pockets into surrounding light antialias pixels
    bgd=ndimage.binary_dilation(bg,iterations=1)&white
    bg|=bgd
    fg=~bg
    lab2,n2=ndimage.label(fg)
    if n2>1:
        sz=ndimage.sum(fg,lab2,range(1,n2+1)); keep=sz>=0.02*sz.max(); fg=keep[lab2-1]&(lab2>0)
    alpha=Image.fromarray((fg*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6))
    out=im.convert('RGBA'); out.putalpha(alpha)
    return out.crop(out.getbbox())
