// 지붕·나무 가림 조각. 맵 그림에서 해당 모양만 오려 캐릭터 위층에 올림.
// 캐릭터 발(y)이 baseY보다 위(북쪽)에 있으면 조각이 캐릭터를 덮고, 아래면 캐릭터가 앞에 그려짐.
// 조각 좌표는 맵 좌표계(mapWidth 기준). 맵 그림이 더 크면(고해상도) 그 해상도로 오려서 줄여 그림.

export function createOccluders(scene, mapTextureKey, occluders, mapWidth) {
  const src = scene.textures.get(mapTextureKey).getSourceImage();
  const k = src.width / mapWidth; // 그림 픽셀 / 맵 좌표
  const images = [];
  occluders.forEach((o, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(o.w * k);
    canvas.height = Math.round(o.h * k);
    const ctx = canvas.getContext('2d');
    ctx.scale(k, k);
    ctx.beginPath();
    if (o.shape === 'ellipse') {
      ctx.ellipse(o.w / 2, o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
    } else if (o.shape === 'poly' && Array.isArray(o.points)) {
      // points: [[x, y], ...] 맵 좌표
      o.points.forEach(([px, py], j) => (j ? ctx.lineTo(px - o.x, py - o.y) : ctx.moveTo(px - o.x, py - o.y)));
      ctx.closePath();
    } else {
      ctx.rect(0, 0, o.w, o.h);
    }
    ctx.clip();
    ctx.drawImage(src, -o.x, -o.y, src.width / k, src.height / k);

    const key = `${mapTextureKey}/occ${i}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
    images.push(
      scene.add.image(o.x, o.y, key).setOrigin(0, 0).setDisplaySize(o.w, o.h).setDepth(o.baseY)
    );
  });
  return images;
}
