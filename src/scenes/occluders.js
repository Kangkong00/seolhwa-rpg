// 지붕·나무 가림 조각. 맵 그림에서 해당 모양만 오려 캐릭터 위층에 올림.
// baseY = 그 건물 앞벽이 땅에 닿는 선. 캐릭터 발이 baseY보다 북쪽이고 hideX 범위 안이면 조각이 캐릭터를 덮음.
// 조각에는 지붕·나무 윗부분만 넣고 벽·마당·땅은 넣지 않음 (shape: poly, points로 윤곽을 따라감).
// 조각 좌표는 맵 좌표계(mapWidth×mapHeight). 맵 그림이 더 크면(고해상도) 그 해상도로 오려서 줄여 그림.
// mapHeight가 그림 비율보다 크면(시험용 세로 배율) 그림도 세로로 늘려서 오림.

export function createOccluders(scene, mapTextureKey, occluders, mapWidth, mapHeight) {
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
    ctx.drawImage(src, -o.x, -o.y, mapWidth, mapHeight);

    const key = `${mapTextureKey}/occ${i}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
    images.push({
      image: scene.add.image(o.x, o.y, key).setOrigin(0, 0).setDisplaySize(o.w, o.h).setDepth(o.baseY),
      baseY: o.baseY,
      // 캐릭터 발이 이 가로 범위 안에 있을 때만 가릴 수 있음 (없으면 조각의 가로 범위)
      hideX: Array.isArray(o.hideX) ? o.hideX : [o.x, o.x + o.w],
    });
  });
  return images;
}
