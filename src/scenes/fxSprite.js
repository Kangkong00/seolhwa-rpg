// 효과 그림 공용 도구(docs/spec/feedback_1022.md 4). assets/fx/<id>.png(검은 바탕 붓 효과 그림)를
// 더하기 섞기(ADD)로 그려 검은 바탕은 사라지고 빛만 남음. 키우기·돌리기·늘리기·흐리기를 ms 동안.
// 그림이 아직 없으면(기획 쪽 Flow 136~138 대기) fxSprite는 null을 돌려주고, fxOr는 지금 도형 연출(fallback)을 부름.
// 그림 목록·경로는 data/game.json fxImages. 받는 것은 게임에서 한 번만(맵을 옮겨도 다시 받지 않음).

const key = (id) => `fx:${id}`;

// MapScene.preload에서 부름. 없는 그림은 조용히 넘어감
export function preloadFx(scene, cfg) {
  if (!cfg || scene.registry.get('fxTried')) return;
  scene.registry.set('fxTried', true);
  scene.load.on('loaderror', (file) => {
    if (String(file.key).startsWith('fx:')) file.cache = null; // 없는 효과 그림은 무시(도형 연출로 대신)
  });
  for (const id of cfg.ids) if (!scene.textures.exists(key(id))) scene.load.image(key(id), `${cfg.path}${id}.png`);
}

export function hasFx(scene, id) {
  return scene.textures.exists(key(id));
}

// 효과 그림 하나: (x, y)에 그려 ms 동안 to까지 변하며 흐려지고 사라짐.
// o: { scale(처음 크기 배율), rot(도, 처음 기울기), stretch(가로로 늘리기), alpha, ms, depth, tint(색 물들임),
//      originX·originY, to: { scale, rot, stretch, alpha, x, y } (끝 값, 없으면 그대로·alpha 0), ease }
export function fxSprite(scene, id, x, y, o = {}) {
  if (!hasFx(scene, id)) return null;
  const scale = o.scale ?? 1;
  const stretch = o.stretch ?? 1;
  const img = scene.add.image(x, y, key(id))
    .setOrigin(o.originX ?? 0.5, o.originY ?? 0.5)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(scale * stretch, scale)
    .setAngle(o.rot ?? 0)
    .setAlpha(o.alpha ?? 1)
    .setDepth(o.depth ?? 1e6 - 3);
  if (o.tint !== undefined) img.setTint(typeof o.tint === 'string' ? Phaser.Display.Color.HexStringToColor(o.tint).color : o.tint);
  // 무예를 쓰는 동안이면 무예 연출 층(빛 번짐)에
  if (scene.skillFx) scene.skillFx.add(img);
  const to = o.to || {};
  const ts = to.scale ?? scale;
  const tst = to.stretch ?? stretch;
  scene.tweens.add({
    targets: img,
    scaleX: ts * tst,
    scaleY: ts,
    angle: to.rot ?? (o.rot ?? 0),
    alpha: to.alpha ?? 0,
    x: to.x ?? x,
    y: to.y ?? y,
    duration: o.ms ?? 400,
    ease: o.ease || 'Cubic.easeOut',
    onComplete: () => img.destroy(),
  });
  return img;
}

// 그림이 있으면 그림, 없으면 fallback()(지금 도형 연출)
export function fxOr(scene, id, x, y, o, fallback) {
  const img = fxSprite(scene, id, x, y, o);
  if (!img && fallback) fallback();
  return img;
}
