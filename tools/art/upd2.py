import cv2, numpy as np
img=cv2.imread('/root/.claude/uploads/be5b45b3-e0a4-5e3d-966b-87fd9240d272/a5917b96-image.jpg'); H,W=img.shape[:2]; print(W,H)
# find watermark: bright small blob bottom-right
cx,cy=1278,670
mask=np.zeros((H,W),np.uint8); cv2.circle(mask,(cx,cy),30,255,-1); img=cv2.inpaint(img,mask,7,cv2.INPAINT_TELEA)
cv2.imwrite('rat1_clean.png',img)
sr=cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel('EDSR_x4.pb'); sr.setModel('edsr',4)
T=160;P=8; out=np.zeros((H*4,W*4,3),np.uint8)
for yy in range(0,H,T):
    for xx in range(0,W,T):
        y0,x0=max(0,yy-P),max(0,xx-P); y1,x1=min(H,yy+T+P),min(W,xx+T+P); o=sr.upsample(img[y0:y1,x0:x1])
        oy,ox=(yy-y0)*4,(xx-x0)*4; h=min(T,H-yy)*4; w=min(T,W-xx)*4; out[yy*4:yy*4+h,xx*4:xx*4+w]=o[oy:oy+h,ox:ox+w]
x2=cv2.resize(out,(W*2,H*2),interpolation=cv2.INTER_AREA)
cv2.imwrite('/home/claude/seolhwa-rpg/assets/maps/dungeon_rat_1.jpg',x2,[cv2.IMWRITE_JPEG_QUALITY,93]); cv2.imwrite('rat1_x2.png',x2)
