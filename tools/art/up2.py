import cv2, numpy as np
img=cv2.imread('village_clean.png'); H,W=img.shape[:2]
sr=cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel('EDSR_x4.pb'); sr.setModel('edsr',4)
T=160; P=8; out=np.zeros((H*4,W*4,3),np.uint8)
for y in range(0,H,T):
    for x in range(0,W,T):
        y0,x0=max(0,y-P),max(0,x-P); y1,x1=min(H,y+T+P),min(W,x+T+P)
        o=sr.upsample(img[y0:y1,x0:x1])
        oy,ox=(y-y0)*4,(x-x0)*4; h=min(T,H-y)*4; w=min(T,W-x)*4
        out[y*4:y*4+h,x*4:x*4+w]=o[oy:oy+h,ox:ox+w]
x2=cv2.resize(out,(W*2,H*2),interpolation=cv2.INTER_AREA)
cv2.imwrite('village_x2.png',x2); cv2.imwrite('village_x2.jpg',x2,[cv2.IMWRITE_JPEG_QUALITY,93])
# comparison crop: bicubic vs edsr at 3x display of a region
reg=(560,180,760,330)
bic=cv2.resize(img[180:330,560:760],None,fx=3,fy=3,interpolation=cv2.INTER_CUBIC)
ed=cv2.resize(out[180*4:330*4,560*4:760*4],None,fx=0.75,fy=0.75,interpolation=cv2.INTER_AREA)
cv2.imwrite('cmp.png',np.hstack([bic,ed]))
