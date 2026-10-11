import numpy as np
from scipy import ndimage
def topknot_mask(body_rgba, hood_rgba):
    """Top-knot pixels sticking out above the hood: body pixels above the hood's top edge in each column
    (hood columns, edges extended 25px). Components that are mostly skin (fists) or reach beyond that
    column band (arms) are kept."""
    b=body_rgba.astype(int); ha=hood_rgba[...,3]>40; ba=b[...,3]>20
    cols=np.where(ha.any(0))[0]; lo,hi=cols.min(),cols.max(); W=b.shape[1]
    top=np.full(W,-1)
    for x in cols: top[x]=np.argmax(ha[:,x])
    for x in range(max(0,lo-25),lo): top[x]=top[lo]+(lo-x)
    for x in range(hi+1,min(W,hi+26)): top[x]=top[hi]+(x-hi)
    above=np.zeros(ba.shape,bool)
    for x in range(W):
        if top[x]>0: above[:top[x]+1,x]=True
    E=ba&above
    lab,n=ndimage.label(E)
    r,g,bb=b[...,0],b[...,1],b[...,2]; skin=(r>185)&(bb>=0.6*r)&(g<0.93*r)
    out=np.zeros(ba.shape,bool)
    for i in range(1,n+1):
        c=lab==i; ys,xs=np.where(c)
        if skin[c].mean()>0.3: continue
        # an arm/fist entering from outside the band: touches the band's side limits
        if (xs.min()<=max(0,lo-25) or xs.max()>=min(W-1,hi+25)) and skin[c].mean()>0.08: continue
        out|=c
    out=ndimage.binary_dilation(out,iterations=1)&ba
    # pieces left floating after the erase (e.g. a ribbon tip) go too
    rest=ba&~out; l2,n2=ndimage.label(rest)
    if n2>1:
        sz=ndimage.sum(rest,l2,range(1,n2+1)); big=sz.max()
        for i,s in enumerate(sz,1):
            if s<0.01*big and (l2==i).nonzero()[0].max()<top[cols].min()+220: out|=(l2==i)
    return out
